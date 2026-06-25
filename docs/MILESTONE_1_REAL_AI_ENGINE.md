# Milestone 1 — Real AI Engine

**Status:** Design / awaiting approval (no implementation yet)
**Author:** Lead Engineering
**Scope:** Replace every simulated AI/data capability with production-ready
implementations, end-to-end, with usage tracking, error handling, retries, and
comprehensive tests.

> Guiding principle: optimize for long-term quality — correctness, reliability,
> security, scalability, maintainability, and developer experience — not speed.
> Every capability must work end-to-end with **no mocks in production**.

---

## 1. Inventory of simulated / placeholder AI (what we are replacing)

Every item below was confirmed by reading the current source.

| # | Location | What it pretends to do | What it actually does |
|---|---|---|---|
| 1 | `backend/src/agents/tasks.py` (all stages) | Ingest, OCR, extract, schema, validate, clean | `time.sleep()` + hardcoded log strings; **no file is read, no model is called** |
| 2 | `agents/tasks.py::run_extraction_pipeline_task` | Produce a dataset | Finalizes with `random.randint()` for `record_count`/`quality_score`, `column_count = 8` |
| 3 | `agents/tasks.py::run_web_crawling_task` | Scrape the configured source | Fetches a **hardcoded** `https://en.wikipedia.org/wiki/Data_science` regardless of input |
| 4 | `copilot/router.py::generate_fallback_llm_response` | LLM copilot | Keyword `if/elif` returning canned text + fake "cards" |
| 5 | `copilot/tasks.py::run_copilot_query_task` | Stream LLM tokens | Splits canned text on spaces, emits word-by-word with `time.sleep(0.04)` |
| 6 | `requirements.txt` | `openai`, `anthropic`, `google-generativeai`, `beautifulsoup4` | Declared but **never imported / used** |
| 7 | `datasets.Dataset` | Store extracted data | Only metadata exists; **no table or object holds real rows**; `s3_path` is a string never written |
| 8 | `frontend ExtractionPage.tsx` step 4 | Schema validation + quality | `MockSchemaField[]`, `qualityScore = 89.5`, `handleApplyFix` increments a number |
| 9 | `frontend ExtractionPage.tsx::triggerLaunchFlow` | Launch pipeline | Client-side fake terminal (`setTimeout` logs: "Tesseract-OCR", "gpt-4o-mini") |
| 10 | `frontend FileForm`/wizard | Upload a document | Captures only `{ fileName, fileSize }`; the real `File` is **never sent**; `api.upload` is unused |
| 11 | UI → backend `config` | Pass source params | The source **URL/endpoint is never included** in `createProject` config |

**Conclusion:** there is no real data path from the UI to the backend, and no AI
anywhere. M1 must build the whole path: upload/ingest → parse (PDF/OCR/image/
tabular) → structured extraction → validation/quality → storage (object store) →
embedding/index (RAG) → grounded Copilot — plus the cross-cutting LLM gateway,
usage tracking, retries, observability, and tests.

---

## 2. Architecture overview

### 2.1 Layered design (new `src/` packages)

```
ingestion/      acquire raw bytes from a source (upload, URL, API) — SSRF-safe
processing/     turn raw bytes into a normalized ParsedDocument (PDF/OCR/image/CSV/Excel/JSON)
extraction/     schema infer + LLM structured extraction + validation + write artifact
ai/llm/         provider abstraction, model registry, gateway (retry/fallback/stream), usage
ai/embeddings/  embedding service (via gateway)
ai/rag/         chunking, vector store (pgvector), retriever, RAG answer pipeline
storage/        object-store abstraction (S3 / MinIO), presigned URLs
agents/         orchestrator: real Celery chain wiring the stages (rewrite of tasks.py)
copilot/        CopilotService: RAG + real DB-backed tool-calls + token streaming
```

### 2.2 End-to-end data flow

```
[Wizard] --multipart--> POST /datasets/{id}/files --> storage (raw) + source_files row
[Wizard] --json config (url/endpoint/fields/schema)--> POST /datasets/{id}/run
                                                              |
                                                        Celery chain (heavy_ops)
   ingest ─▶ parse ─▶ extract ─▶ validate ─▶ write(Parquet) ─▶ embed+index(pgvector)
     │        │         │           │            │                 │
     └────────┴─────────┴───────────┴────────────┴── emits the SAME WebSocket events
                 (pipeline.progress / agent.status.changed / pipeline.log /
                  pipeline.completed / dataset.generated; extraction stream
                  type: log|status|progress|completed|failed)  ◀── frontend unchanged
                                                              |
[DatasetDetail] <-- GET /datasets/{id}/records (paged sample from artifact)
[Copilot]  WS copilot.query --> CopilotService (RAG over workspace data + tools) --> copilot.streaming
```

**Contract preservation is a first-class requirement.** The existing real-time
event names/shapes emitted by `agents/tasks.py` and consumed by the frontend
(`agentStore`, extraction WS) are a public contract. The rewrite keeps them
byte-compatible so the live telemetry UI needs **no changes**; only the *content*
becomes real. New UI work is limited to (a) actually uploading files, (b) sending
real source params, and (c) reading real records/quality.

---

## 3. Data model & infrastructure changes

### 3.1 New tables (Alembic migration; pgvector)

- `source_files` — `id, workspace_id, dataset_id, original_filename, content_type,
  size_bytes, storage_key, checksum_sha256, status, created_at`.
- `data_artifacts` — extracted output pointer: `id, dataset_id, run_id, storage_key,
  format(parquet|csv|json), row_count, column_count, byte_size, created_at`.
- `dataset_columns` — per-column profile for the validation UI: `id, dataset_id,
  name, dtype, null_rate, unique_count, sample_values jsonb, status(valid|warning|fixed), created_at`.
- `document_chunks` — RAG: `id, workspace_id, dataset_id?, source_file_id?,
  chunk_index, content text, token_count, embedding vector(N), metadata jsonb,
  created_at`. HNSW index on `embedding`; btree `(workspace_id, dataset_id)`.
- `llm_usage_events` — `id, workspace_id, user_id?, feature, provider, model,
  prompt_tokens, completion_tokens, total_tokens, cost_usd numeric(12,6),
  latency_ms, status, run_id?, created_at`. Index `(workspace_id, created_at)`.

Reuse existing: `dataset.schema_config` (declared/inferred schema JSON),
`dataset.s3_path` (→ artifact storage key), `AgentMetrics` (finally **populated**
with real per-stage metrics).

### 3.2 Extracted-row storage decision

Store extracted rows as **Parquet in object storage** (pointer in `data_artifacts`),
not in Postgres. Rationale: datasets can be large; Postgres stays metadata-only;
Parquet is columnar/portable; the UI reads a **paged sample** via an API that
streams from the artifact. (Recommended; alternative — a rows table — rejected for
scale.)

### 3.3 Infrastructure

- **Postgres image → pgvector-enabled** (`pgvector/pgvector:pg16`); migration runs
  `CREATE EXTENSION IF NOT EXISTS vector`.
- **MinIO** service added to `docker-compose` for S3-compatible storage in dev;
  prod points the same `boto3` client at AWS S3 / Cloudflare R2.
- **Backend image system deps**: `tesseract-ocr`, `poppler-utils` (pdf rasterize),
  `libmagic1` (MIME sniffing). Added to the Dockerfile runner stage.
- Optional: a dedicated **`ai-worker`** consuming `heavy_ops` separately from the
  fast `high_priority` worker, so OCR/LLM load can't starve notifications.

### 3.4 New Python dependencies (pinned in implementation)

`pymupdf`, `pdfplumber`, `pdf2image`, `pillow`, `pytesseract`, `pandas`,
`openpyxl`, `pyarrow`, `python-magic`, `tiktoken`, `tenacity`, `pgvector`,
`boto3`, `selectolax` (or keep `beautifulsoup4`), plus the already-declared
`openai`, `anthropic`, `google-generativeai`. (Vision/image-understanding uses the
LLM gateway, not a separate dep.)

---

## 4. Component designs

### 4.1 LLM provider abstraction & multi-model (`ai/llm/`)
- `LLMProvider` protocol: `complete()`, `stream()`, `embed()`, `vision()`, each
  returning a normalized result carrying **token usage**.
- Adapters: `OpenAIProvider`, `AnthropicProvider`, `GeminiProvider`, plus a
  deterministic `MockProvider` (used only when `AI_ALLOW_MOCK=true` and no real key —
  for CI/offline; never silent in prod).
- `ModelRegistry`: logical roles (`fast`, `smart`, `vision`, `embed`) → concrete
  provider+model, overridable per request and via settings.
- `LLMGateway`: single entry point adding timeouts, **retries (tenacity, exp
  backoff + jitter)** for transient errors, **provider fallback chains**, a per-
  provider **circuit breaker**, and **usage capture** to `llm_usage_events` +
  Prometheus. Streaming yields tokens via async generators, bridged to the existing
  Redis→WebSocket plumbing.

### 4.2 Real document ingestion (`ingestion/`)
- `BaseConnector.fetch() -> list[RawDocument]`.
- `FileConnector` (uploaded pdf/csv/excel/image/json from object storage),
  `UrlConnector` (httpx + HTML parse; honors `tableOnly`; `jsRendering` via
  Playwright **deferred** to a later phase), `ApiConnector` (REST, pagination,
  headers/method from the wizard).
- Upload endpoint: streamed multipart → object storage; validation — extension
  allowlist, **true MIME sniff (libmagic)**, size cap (`MAX_UPLOAD_BYTES`),
  checksum. Frontend wizard rewired to actually upload and to pass source params.
- **SSRF guard** on URL/API connectors: scheme allowlist (http/https), block
  private/link-local/loopback/metadata IPs, cap redirects/size/time, DNS-rebind
  mitigation.

### 4.3 PDF / OCR / image / Excel / CSV (`processing/`)
- Normalized IR `ParsedDocument` (text blocks, tables, metadata, page refs).
- **PDF**: PyMuPDF for native text + page rasterization; pdfplumber for tables; if a
  page has no text layer → **OCR fallback**. Page cap guards decompression bombs.
- **OCR**: `OCREngine` abstraction; Tesseract (`pytesseract`) default (free,
  offline), pluggable cloud (Textract/Vision) for accuracy.
- **Image understanding**: vision LLM via the gateway (caption + structured fields);
  Pillow for normalization/metadata.
- **Excel**: openpyxl/pandas (multi-sheet); **CSV**: pandas with encoding
  (`charset-normalizer`) + delimiter sniffing; **JSON**: schema-aware flattening.

### 4.4 Structured extraction (`extraction/`)
- `schema_infer`: if the user didn't declare fields, the LLM proposes a schema from a
  sample; validated and stored in `dataset.schema_config`.
- `extractor`: LLM **JSON-mode / tool-calling** constrained to a Pydantic schema
  built from `schema_config`/`target_fields`; per-record validation; retries on
  malformed output.
- `validation`: Pydantic + business rules; computes **real** `quality_score`
  (null rate, type conformance, constraint violations) and per-column stats →
  `dataset_columns` (powers the wizard's step-4 UI for real).
- `writer`: DataFrame → **Parquet** in object storage → `data_artifacts` row;
  updates `dataset.record_count/column_count/quality_score/status`.

### 4.5 Embeddings + Vector DB + Semantic Search + RAG (`ai/rag/`)
- `chunking`: token-aware splitter (tiktoken) with overlap.
- `VectorStore` abstraction; **pgvector** implementation (HNSW, cosine), plus an
  in-memory impl for unit tests. All queries **scoped by `workspace_id`** (tenant
  isolation).
- `indexer`: extracted records + parsed documents → chunks → embeddings → store.
- `retriever`: semantic top-k search scoped by workspace/dataset → exposed as
  `POST /api/search`.
- `rag.pipeline`: retrieve → build grounded prompt (retrieved text clearly delimited
  and **treated as untrusted**) → stream answer with **citations**; no-answer
  fallback; context-token cap.

### 4.6 Real AI Copilot (`copilot/`)
- `CopilotService` replaces `generate_fallback_llm_response`: RAG grounding over the
  workspace's real datasets/documents + **real DB-backed tool-calls** (`tools.py`):
  `get_dataset_quality`, `list_failed_runs`, `propose_cleaning_rules`,
  `suggest_optimizations`. Cards are now produced from real queries.
- Streams **real LLM tokens** over the existing `copilot.streaming` WS contract
  (same event shape) — only the source of tokens changes.

### 4.7 Orchestrator rewrite (`agents/tasks.py`)
- Replace the `.run()` synchronous simulation with a real **Celery `chain`/`chord`**
  across `heavy_ops`: `ingest → parse → extract → validate → write → index → finalize`.
- Each stage: real work, real `AgentMetrics`, idempotent, `autoretry_for` transient
  errors with backoff, poison tasks → `dead_letter`. Emits the **same** WS events
  (contract preserved). Real durations/throughput replace the fixed sleeps.

---

## 5. Cross-cutting concerns

- **Config** (settings additions): default/fast/vision/embed model names, embed dim,
  OCR engine, LLM timeout/retries, `AI_ALLOW_MOCK`, storage endpoint/bucket/keys,
  `MAX_UPLOAD_BYTES`, `MAX_PDF_PAGES`, `RAG_TOP_K`, `RAG_MAX_CONTEXT_TOKENS`, and a
  per-workspace monthly **token/cost cap**.
- **Security**: tenant scoping everywhere; upload hardening (allowlist + magic +
  size/page caps + zip-bomb guard, stored in object store, never executed, parsed
  with timeouts); SSRF guard; **prompt-injection mitigations** (system/user/
  retrieved separation, output schema validation, tool-call allowlist, never execute
  model output); secrets via env only; PII minimization (Sentry PII already opt-in
  from M0); per-workspace quotas to cap cost/abuse.
- **Error handling & retries**: typed hierarchy (`AIError`, `ProviderError`,
  `RateLimitError`, `ParsingError`, `ExtractionError`, `StorageError`); tenacity
  backoff for transient, no-retry for 4xx/validation; provider fallback + circuit
  breaker; failures surfaced via WS + `run.error_message`.
- **Usage tracking & observability**: `llm_usage_events` + Prometheus
  (`llm_tokens_total`, `llm_cost_usd_total`, `llm_request_duration_seconds`,
  `llm_errors_total`, `ocr_pages_total`, `extraction_records_total`,
  `vector_search_duration_seconds`) + a Grafana panel + `GET /api/usage`; structured
  logs correlated by `run_id`/`workspace_id`.
- **Developer experience**: `Makefile`/`justfile` (migrate/test/lint/fmt/up/seed/eval);
  `tests/fixtures/` sample files; deterministic `MockProvider` so the unit suite is
  **network-free** (matches our offline sandbox); full type hints + mypy + ruff
  clean; `.env.example` AI section documented.

---

## 6. API contract changes (new; existing WS contract preserved)

- `POST /api/datasets/{id}/files` (multipart) — upload source file → object storage.
- `POST /api/extraction/{id}/preview` — sample parse + schema inference → returns
  inferred columns, sample rows, preliminary quality (**replaces hardcoded step-4**).
- `POST /api/extraction/{id}/run` (or keep current WS trigger) — start the real chain.
- `GET /api/datasets/{id}/records?cursor=&limit=` — paged real rows from the artifact.
- `GET /api/datasets/{id}/download?format=parquet|csv|json` — presigned/streamed export.
- `POST /api/search` — semantic search over workspace data.
- `GET /api/usage` — workspace token/cost summary.
- Copilot endpoints/WS unchanged in shape; content becomes real.
- **Fix** `ProjectCreate.source_type` to match the UI: add `json`; `database` is
  **deferred** (greyed-out / "coming soon" in UI rather than 422).

---

## 7. Testing strategy

- **Unit (sqlite + MockProvider, no network):** connectors (fixtures), parsers
  (pdf/csv/excel/image), chunking, schema infer, extractor (mock JSON), validation/
  quality math, LLM gateway (retry/fallback/usage), in-memory vector retrieval,
  copilot tools, upload validation + SSRF guard, usage recording.
- **Integration (Postgres+pgvector+Redis+MinIO in CI):** migrations incl. `CREATE
  EXTENSION vector`; full pipeline (upload→parse→extract→validate→write→index) with
  deterministic mock; pgvector retrieval; copilot stream over WS; artifact paging;
  presigned download.
- **Provider contract tests:** recorded cassettes validate request shaping + usage
  parsing; skipped without keys.
- **Eval harness (non-blocking):** golden docs → expected extraction; field-level
  accuracy; run on demand (cost/nondeterminism keep it out of the PR gate).
- **Security tests:** oversize/bad-MIME/zip-bomb rejected; SSRF blocked; prompt-
  injection canary (output validated/sanitized).
- **Coverage gate** raised for new AI packages (target ≥85%); suite stays network-free.

---

## 8. Phased delivery (each phase = its own PR + tests + docs + self-review)

| Phase | Title | Key deliverables | Acceptance |
|---|---|---|---|
| **M1.0** | Foundations & contracts | object-store abstraction + MinIO; pgvector image; migrations (new tables + `CREATE EXTENSION vector`); Docker system deps; config; Makefile; fixtures; MockProvider scaffold | migrations apply on PG; compose boots MinIO+pgvector; storage round-trip test; **no behavior change** |
| **M1.1** | Real ingestion & upload | upload endpoint + validation; SSRF-safe URL/API connectors; wire wizard to upload + send source params; fix source_type set | real file in object store + `source_files` row; real URL/API fetch; e2e tests |
| **M1.2** | Document processing | PDF (text+tables), OCR (scanned), CSV, Excel, JSON, image (vision) → ParsedDocument | fixture parser tests; scanned PDF → OCR text; page/table metrics |
| **M1.3** | LLM gateway + usage | providers, registry, gateway (retry/fallback/stream), usage events + Prometheus + `/api/usage` | provider contract tests; retry/fallback unit tests; usage recorded; mock offline |
| **M1.4** | Structured extraction + real pipeline | schema infer, extractor, validation/quality, Parquet writer; **rewrite `agents/tasks.py`** (real chain, same WS events); preview + records + download endpoints; wire DatasetDetail + step-4 | real dataset from each source with real numbers; deterministic e2e; frontend telemetry unchanged |
| **M1.5** | Embeddings + Vector DB + RAG + search | chunk/embed/index; pgvector `VectorStore`; retriever; `/api/search` | index→retrieve relevant chunks scoped by workspace; pgvector integration tests |
| **M1.6** | Real AI Copilot | `CopilotService` (RAG + real tool-calls) + token streaming over existing WS | grounded answers w/ citations + real cards; streaming; tool tests |
| **M1.7** | Hardening, evals, docs, perf | quotas/rate limits, circuit breakers, eval harness, Grafana panels, perf checks, a11y of new UI, docs, raise coverage gate | quota enforcement test; eval baseline; docs updated; CI green |

Sequencing rationale: storage/migrations/contracts first (de-risk infra), then a
real data path (ingest→process→extract→store) before AI-heavy RAG/Copilot, so each
layer is testable on its own and the product is demonstrably "real" as early as M1.4.

---

## 9. Open decisions (recommended defaults in **bold**)

1. Vector store: **pgvector** vs Qdrant. (pgvector reuses Postgres; abstraction keeps Qdrant open.)
2. OCR: **Tesseract (free, offline)** vs cloud Textract/Vision (cost, accuracy).
3. Prod object storage: abstraction with **MinIO dev / S3 or R2 prod**.
4. Extracted rows: **Parquet in object storage** vs Postgres rows table.
5. Default models (e.g., **smart=gpt-4o / fast=gpt-4o-mini / vision=gpt-4o / embed=text-embedding-3-small**) and whether to allow per-workspace BYO keys (propose: later).
6. Playwright JS-rendering for `jsRendering`: **defer** (heavy image footprint).
7. `database` connector (PG/MySQL/Mongo sync): **defer**; grey-out in UI now.
8. Per-workspace monthly cost cap default (propose a conservative starting value).

## 10. Out of scope for M1 (candidate M2)

Scheduled pipeline execution (dynamic celery-beat cron), data lineage graph,
fine-tuning, multi-step autonomous agents beyond the pipeline, collaborative editing.

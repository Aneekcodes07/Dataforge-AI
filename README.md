# DataForge AI

> An enterprise-grade, AI-powered Data Engineering & Operations Platform.

DataForge AI is a modern data operations platform designed to orchestrate ingestion, extraction, cleaning, and analysis workflows. It features a dark-first glassmorphic visual dashboard, real-time agent telemetry, a unified API reverse-proxy, and a fully integrated Prometheus/Grafana observability stack.

---

## 🚀 Key Features

* **Glassmorphic Data Operations Portal**: Modern, responsive React dashboard optimized with a limited accent palette (orange, green, cyan, purple) for technical clarity.
* **AI Extraction & Agent Workspace**: Orchestrate multi-agent networks utilizing LLMs (OpenAI, Anthropic, Gemini) for schema discovery, validation, and structured ingestion.
* **Celery Distributed Task Queue**: Scalable background task engine executing pipelines asynchronously with Redis as a message broker.
* **Robust Database Integration**: PostgreSQL for transactional state management and metadata persistence, backed by SQLAlchemy and Alembic migrations.
* **Production Observability**: Metric scraping via Prometheus, alerting rule configurations, Grafana visualization dashboards, and Sentry error monitoring.
* **Unified Router Ingress**: Hardened Nginx configuration proxying API routes, WebSockets, and serving static frontend SPA assets.

---

## 🛠️ Technology Stack

| Layer | Component | Technology | Version / Specification |
|---|---|---|---|
| **Frontend** | Framework | React 19 + TypeScript | SPA routing with lazy-loading |
| | Build | Vite 6 | Fast HMR, optimized production build |
| | Styling | TailwindCSS 4 | Utility-first, native CSS variables |
| | Animations | Motion (Framer Motion) 12 | Smooth UI micro-interactions |
| | State | Zustand | Lightweight client stores |
| **Backend** | API Server | FastAPI | High-performance ASGI framework |
| | Scheduler | Celery + Celery Beat | Distributed tasks & periodic checks |
| | Cache & Broker | Redis 7 | Pub/Sub websocket bridge & broker |
| | Database | PostgreSQL 15 | SQLAlchemy 2.0 ORM, Alembic migrations |
| **Infra & Ops**| Ingress | Nginx | HTTP & WebSocket reverse proxy, SPA fallback |
| | Observability | Prometheus & Grafana | Scraping `/api/monitoring/metrics` |
| | Node Telemetry | Node Exporter | Hardware/OS metrics gathering |
| | Errors | Sentry SDK | Backend FastAPI and worker error tracking |

---

## ⚙️ Environment Configurations

DataForge AI relies on `.env` settings to initialize resources. Copy `.env.example` to `.env` and configure accordingly:

```bash
cp .env.example .env
```

| Variable | Description | Default / Example |
|---|---|---|
| `SECRET_KEY` | Flask/FastAPI signature key | `prod-secret-key-change-in-production` |
| `JWT_SECRET` | Auth token encryption key | `prod-jwt-secret-key-change-in-production` |
| `DATABASE_URL` | SQLAlchemy PostgreSQL URI | `postgresql://dataforge:secure_pass@postgres:5432/dataforge_ai` |
| `REDIS_URL` | Redis Broker connection URI | `redis://redis:6379/0` |
| `OPENAI_API_KEY` | OpenAI API credentials | `your_openai_api_key_here` |
| `ANTHROPIC_API_KEY`| Anthropic API credentials | `your_anthropic_api_key_here` |
| `GEMINI_API_KEY` | Gemini API credentials | `your_gemini_api_key_here` |
| `SENTRY_DSN` | Sentry backend telemetry DSN | `your_backend_sentry_dsn_here` |
| `VITE_SENTRY_DSN` | Sentry web client telemetry DSN| `your_frontend_sentry_dsn_here` |
| `GRAFANA_ADMIN_PASSWORD` | Grafana admin dashboard password| `admin` |

---

## 🐳 Docker Deployment (Recommended)

DataForge AI provides a complete Docker Compose environment that spins up the full application, databases, scheduler, and monitoring tools.

### Prerequisite
Ensure Docker and Docker Compose (v2+) are installed.

### Start the Platform
Run the following command at the repository root to build and run all services:

```bash
docker compose up --build -d
```

### Services Mapping

* **Web Entrance / App**: `http://localhost` (Nginx proxies `/` to React frontend container and `/api` to FastAPI backend)
* **Prometheus Server**: `http://localhost:9090` (Self-scraping and backend exporter metrics)
* **Grafana Visualization**: `http://localhost:3000` (Pre-provisioned with Postgres, System Health, and Pipeline dashboard panels)
* **FastAPI Docs (ReDoc/Swagger)**: `http://localhost/api/docs`

---

## 💻 Local Development Setup

If running components independently for development:

### Backend (Python FastAPI)

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: .\venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   pip install -r requirements-dev.txt
   ```
4. Run migrations:
   ```bash
   alembic upgrade head
   ```
5. Start local development server:
   ```bash
   uvicorn src.main:app --reload --port 8000
   ```

### Frontend (React + Vite)

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install npm pack dependencies:
   ```bash
   npm install
   ```
3. Start local HMR development server:
   ```bash
   npm run dev
   ```

---

## 📊 Monitoring & Alerts

The platform metrics stack evaluates service health, Celery queue delays, database latencies, and HTTP response throughputs.
- **Scraper**: Prometheus evaluates scrapers targeting the backend `/api/monitoring/metrics` endpoint.
- **Alert Rules**: Predefined alerts in `prometheus/alert.rules.yml` watch for `HighErrorRate` (>5% failures), `BackendOffline`, `DatabaseOffline`, `RedisOffline`, and `WorkerOffline`.
- **Dashboards**: Predefined dashboard settings are provisioned in Grafana via `grafana/provisioning/` directives.

---

## 🛠️ CI/CD Workflows

Automated verification pipelines run on GitHub Actions (.github/workflows/):
- **Backend CI (`backend-ci.yml`)**: Ruff formatting validation, Ruff code quality linter checks, Mypy static typing checks, Bandit & Safety security audits, and Pytest coverage calculations.
- **Frontend CI (`frontend-ci.yml`)**: ESLint static checks, TypeScript type compiler checks, Trivy filesystem library dependency vulnerability scans, and production compilation builds.
- **Docker CI (`docker-ci.yml`)**: Validates compose configuration and tests backend & frontend image compilations, scanning them with Trivy for high/critical security alerts.
- **Integration Tests CI (`integration-tests.yml`)**: Spins up isolated postgres/redis services to run Alembic migration validations and mock request-response database tests.

---

## ❓ Troubleshooting

#### 1. Backend failed to connect to PostgreSQL database
* Ensure PostgreSQL container is running and healthy.
* If running locally, check that `DATABASE_URL` in `.env` points to `localhost` instead of the internal docker network host `postgres`.

#### 2. WebSocket gateway connection errors (Status 4008)
* Ensure a valid query parameter auth token (`ws://localhost/api/ws?token=<token>`) is supplied to the WebSocket handshake query.

#### 3. React builds fail during type checking
* Run `npx tsc -b` inside the `frontend/` directory to isolate any schema mismatch errors between frontend models and backend responses.

---

## 📄 License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.

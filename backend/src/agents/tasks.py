"""Celery pipeline orchestrator.

Runs the real extraction pipeline for a dataset:

    ingest -> parse -> infer schema -> extract -> validate -> write artifact

The six logical stages map onto the agent ids the frontend already renders
(ingestion, ocr, extractor, schema, validator, cleaner) so the live telemetry UI
is unchanged; only the work and the emitted numbers are now real. Intermediate
data stays in-process (a single task) rather than being serialized through the
broker between sub-tasks.
"""

from __future__ import annotations

import logging
import time
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from src.agents.telemetry import (
    broadcast_agent_telemetry,
    log_and_broadcast_agent_log,
)
from src.ai.llm import get_gateway
from src.celery_app import celery_app
from src.core.database import SessionLocal
from src.core.redis_pubsub import publish_extraction_event, publish_ws_event
from src.datasets.models import DataArtifact, Dataset, DatasetColumn, SourceFile
from src.extraction import (
    extract_records,
    infer_schema,
    validate_and_profile,
    write_dataset,
)
from src.ingestion.connectors import ApiConnector, FileConnector, UrlConnector
from src.ingestion.validation import FILE_SOURCE_TYPES
from src.monitoring.models import AgentMetrics
from src.pipelines.models import Pipeline, PipelineRun
from src.processing import process_raw_document
from src.storage import get_object_store

logger = logging.getLogger(__name__)


class PipelineError(Exception):
    """A non-retryable pipeline configuration/data error."""


def _rss_bytes() -> int:
    try:
        import resource

        return int(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss) * 1024
    except Exception:  # noqa: BLE001 - metrics are best-effort
        return 0


def _record_metrics(
    db: Session,
    run_id: str,
    agent_type: str,
    runtime_seconds: float,
    *,
    records: int = 0,
    queue_size: int = 0,
    status: str = "Completed",
) -> None:
    throughput = round(records / runtime_seconds, 2) if runtime_seconds > 0 else 0.0
    metric = AgentMetrics(
        run_id=uuid.UUID(run_id),
        agent_type=agent_type,
        status=status,
        throughput=throughput,
        queue_size=queue_size,
        cpu_percentage=0,
        memory_bytes=_rss_bytes(),
        runtime_seconds=int(runtime_seconds),
    )
    db.add(metric)
    db.commit()


def _build_connector(dataset: Dataset, config: dict, store, db: Session):
    """Construct the right connector for the dataset's source."""
    stype = (dataset.source_type or "").lower()
    source = config.get("source") if isinstance(config.get("source"), dict) else {}

    if stype in FILE_SOURCE_TYPES:
        source_file = (
            db.query(SourceFile)
            .filter(SourceFile.dataset_id == dataset.id)
            .order_by(SourceFile.created_at.desc())
            .first()
        )
        if not source_file:
            raise PipelineError("No source file has been uploaded for this dataset")
        return FileConnector(
            store,
            source_file.storage_key,
            filename=source_file.original_filename,
            content_type=source_file.content_type,
        )

    if stype == "url":
        url = config.get("url") or source.get("url")
        if not url:
            raise PipelineError("No URL configured for this dataset")
        return UrlConnector(url)

    if stype == "api":
        endpoint = config.get("endpoint") or config.get("url") or source.get("endpoint")
        if not endpoint:
            raise PipelineError("No API endpoint configured for this dataset")
        return ApiConnector(
            endpoint,
            method=config.get("method", "GET"),
            headers=config.get("headers") or {},
            params=config.get("params") or {},
        )

    raise PipelineError(f"Unsupported source type '{stype}'")


def _emit_progress(
    workspace_id, pipeline_id, run_id, project_id, progress: int
) -> None:
    publish_extraction_event(project_id, {"type": "progress", "progress": progress})
    publish_ws_event(
        f"workspace:{workspace_id}",
        "pipeline.progress",
        {"progress": progress, "pipelineId": pipeline_id, "runId": run_id},
    )


@celery_app.task(name="run_extraction_pipeline_task", bind=True)
def run_extraction_pipeline_task(self, run_id: str, project_id: str):
    """Execute the full extraction pipeline for a dataset (project)."""
    logger.info("Starting pipeline run %s for dataset %s", run_id, project_id)
    db = SessionLocal()
    workspace_id: str | None = None
    pipeline_id: str | None = None
    dataset: Dataset | None = None
    run: PipelineRun | None = None

    try:
        dataset = db.query(Dataset).filter(Dataset.id == uuid.UUID(project_id)).first()
        if not dataset:
            return {"status": "failed", "error": "Dataset not found"}
        run = db.query(PipelineRun).filter(PipelineRun.id == uuid.UUID(run_id)).first()
        if not run:
            return {"status": "failed", "error": "PipelineRun not found"}

        workspace_id = str(dataset.workspace_id)
        pipeline = db.query(Pipeline).filter(Pipeline.dataset_id == dataset.id).first()
        pipeline_id = str(pipeline.id) if pipeline else None
        config = (pipeline.run_configuration if pipeline else None) or {}
        target_fields = config.get("target_fields") or config.get("targetFields")

        run.status = "running"
        run.started_at = datetime.now(timezone.utc)
        dataset.status = "Processing"
        db.commit()

        publish_ws_event(
            f"workspace:{workspace_id}",
            "pipeline.started",
            {"pipelineId": pipeline_id, "runId": run_id, "status": "running"},
        )

        store = get_object_store()

        # ---- Stage 1: ingestion ----------------------------------------- #
        broadcast_agent_telemetry(
            workspace_id, project_id, "ingestion", "running", queue_size=1
        )
        _emit_progress(workspace_id, pipeline_id, run_id, project_id, 5)
        t0 = time.monotonic()
        connector = _build_connector(dataset, config, store, db)
        log_and_broadcast_agent_log(
            db,
            workspace_id,
            pipeline_id,
            run_id,
            project_id,
            "ingestion",
            "Acquiring source payload...",
        )
        raw_documents = connector.fetch()
        if not raw_documents:
            raise PipelineError("Source returned no data")
        raw = raw_documents[0]
        log_and_broadcast_agent_log(
            db,
            workspace_id,
            pipeline_id,
            run_id,
            project_id,
            "ingestion",
            f"Fetched {raw.size} bytes from source.",
        )
        _record_metrics(db, run_id, "Ingestion", time.monotonic() - t0)
        broadcast_agent_telemetry(workspace_id, project_id, "ingestion", "completed")
        _emit_progress(workspace_id, pipeline_id, run_id, project_id, 15)

        # ---- Stage 2: parse (ocr) --------------------------------------- #
        broadcast_agent_telemetry(
            workspace_id, project_id, "ocr", "running", queue_size=1
        )
        t0 = time.monotonic()
        parsed = process_raw_document(raw, dataset.source_type or "")
        detail = (
            f"Parsed {parsed.primary_table.row_count} rows"
            if parsed.primary_table
            else f"Extracted {len(parsed.text)} characters of text"
        )
        if parsed.metadata.get("ocr_pages"):
            detail += f" (OCR on {parsed.metadata['ocr_pages']} page(s))"
        log_and_broadcast_agent_log(
            db, workspace_id, pipeline_id, run_id, project_id, "ocr", detail
        )
        _record_metrics(db, run_id, "OCR", time.monotonic() - t0)
        broadcast_agent_telemetry(workspace_id, project_id, "ocr", "completed")
        _emit_progress(workspace_id, pipeline_id, run_id, project_id, 35)

        # ---- Stage 3: extract (schema infer + extraction) --------------- #
        broadcast_agent_telemetry(
            workspace_id, project_id, "extractor", "running", queue_size=1
        )
        t0 = time.monotonic()
        gateway = None
        if parsed.primary_table is None:
            gateway = get_gateway()  # only documents need the LLM
        schema = infer_schema(
            parsed,
            target_fields=target_fields,
            gateway=gateway,
            workspace_id=workspace_id,
            run_id=run_id,
        )
        records = extract_records(
            parsed,
            schema,
            gateway=gateway,
            workspace_id=workspace_id,
            run_id=run_id,
        )
        log_and_broadcast_agent_log(
            db,
            workspace_id,
            pipeline_id,
            run_id,
            project_id,
            "extractor",
            f"Extracted {len(records)} records across {len(schema.fields)} fields.",
        )
        _record_metrics(
            db, run_id, "Extraction", time.monotonic() - t0, records=len(records)
        )
        broadcast_agent_telemetry(workspace_id, project_id, "extractor", "completed")
        _emit_progress(workspace_id, pipeline_id, run_id, project_id, 65)

        # ---- Stage 4: schema -------------------------------------------- #
        broadcast_agent_telemetry(
            workspace_id, project_id, "schema", "running", queue_size=1
        )
        t0 = time.monotonic()
        dataset.schema_config = schema.to_dict()
        db.commit()
        log_and_broadcast_agent_log(
            db,
            workspace_id,
            pipeline_id,
            run_id,
            project_id,
            "schema",
            f"Schema locked: [{', '.join(schema.names)}].",
        )
        _record_metrics(db, run_id, "Schema", time.monotonic() - t0)
        broadcast_agent_telemetry(workspace_id, project_id, "schema", "completed")
        _emit_progress(workspace_id, pipeline_id, run_id, project_id, 75)

        # ---- Stage 5: validate ------------------------------------------ #
        broadcast_agent_telemetry(
            workspace_id, project_id, "validator", "running", queue_size=1
        )
        t0 = time.monotonic()
        validation = validate_and_profile(records, schema)
        db.query(DatasetColumn).filter(DatasetColumn.dataset_id == dataset.id).delete()
        for profile in validation.column_profiles:
            db.add(
                DatasetColumn(
                    dataset_id=dataset.id,
                    name=profile.name,
                    dtype=profile.dtype,
                    null_rate=round(profile.null_rate, 2),
                    unique_count=profile.unique_count,
                    sample_values=[str(v) for v in profile.sample_values],
                    status=profile.status,
                )
            )
        db.commit()
        log_and_broadcast_agent_log(
            db,
            workspace_id,
            pipeline_id,
            run_id,
            project_id,
            "validator",
            f"Quality score {validation.quality_score:.1f}% across {validation.record_count} records.",
        )
        _record_metrics(
            db, run_id, "Validation", time.monotonic() - t0, records=len(records)
        )
        broadcast_agent_telemetry(workspace_id, project_id, "validator", "completed")
        _emit_progress(workspace_id, pipeline_id, run_id, project_id, 85)

        # ---- Stage 6: write artifact (cleaner) -------------------------- #
        broadcast_agent_telemetry(
            workspace_id, project_id, "cleaner", "running", queue_size=1
        )
        t0 = time.monotonic()
        artifact = write_dataset(
            store,
            records,
            schema,
            workspace_id=workspace_id,
            dataset_id=str(dataset.id),
            run_id=run_id,
        )
        db.query(DataArtifact).filter(
            DataArtifact.dataset_id == dataset.id, DataArtifact.run_id == run.id
        ).delete()
        db.add(
            DataArtifact(
                dataset_id=dataset.id,
                run_id=run.id,
                storage_key=artifact.storage_key,
                format=artifact.format,
                row_count=artifact.row_count,
                column_count=artifact.column_count,
                byte_size=artifact.byte_size,
            )
        )
        log_and_broadcast_agent_log(
            db,
            workspace_id,
            pipeline_id,
            run_id,
            project_id,
            "cleaner",
            f"Wrote {artifact.row_count} rows to columnar store ({artifact.byte_size} bytes).",
        )
        _record_metrics(
            db, run_id, "Cleaning", time.monotonic() - t0, records=artifact.row_count
        )
        broadcast_agent_telemetry(workspace_id, project_id, "cleaner", "completed")

        # ---- Finalize --------------------------------------------------- #
        rows = artifact.row_count
        cols = artifact.column_count
        quality = float(validation.quality_score)

        dataset.status = "Ready"
        dataset.record_count = rows
        dataset.column_count = cols
        dataset.quality_score = quality
        dataset.s3_path = artifact.storage_key
        dataset.updated_at = datetime.now(timezone.utc)

        run.status = "completed"
        run.records_processed = rows
        started = run.started_at
        if started and started.tzinfo is None:
            started = started.replace(tzinfo=timezone.utc)
        run.duration_seconds = (
            int((datetime.now(timezone.utc) - started).total_seconds())
            if started
            else 0
        )
        run.finished_at = datetime.now(timezone.utc)
        db.commit()

        publish_ws_event(
            f"workspace:{workspace_id}",
            "pipeline.completed",
            {
                "pipelineId": pipeline_id,
                "runId": run_id,
                "rowCount": rows,
                "columnCount": cols,
                "qualityScore": quality,
                "durationSeconds": run.duration_seconds,
            },
        )
        publish_ws_event(
            f"workspace:{workspace_id}",
            "dataset.generated",
            {
                "datasetId": project_id,
                "name": dataset.name,
                "rowCount": rows,
                "columnCount": cols,
                "qualityScore": quality,
            },
        )
        publish_extraction_event(
            project_id,
            {
                "type": "completed",
                "row_count": rows,
                "column_count": cols,
                "quality_score": quality,
            },
        )
        _emit_progress(workspace_id, pipeline_id, run_id, project_id, 100)
        return {"status": "completed", "run_id": run_id, "rows": rows}

    except Exception as exc:  # noqa: BLE001 - all failures surfaced to the user
        db.rollback()
        logger.error("Pipeline run %s failed: %s", run_id, exc)
        _fail(db, project_id, run_id, workspace_id, pipeline_id, str(exc))
        return {"status": "failed", "error": str(exc)}
    finally:
        db.close()


def _fail(db, project_id, run_id, workspace_id, pipeline_id, message: str) -> None:
    if workspace_id:
        publish_ws_event(
            f"workspace:{workspace_id}",
            "pipeline.failed",
            {"pipelineId": pipeline_id, "runId": run_id, "errorMessage": message},
        )
    publish_extraction_event(
        project_id,
        {"type": "failed", "message": f"Pipeline execution error: {message}"},
    )
    try:
        dataset = db.query(Dataset).filter(Dataset.id == uuid.UUID(project_id)).first()
        if dataset:
            dataset.status = "Failed"
            dataset.updated_at = datetime.now(timezone.utc)
        run = db.query(PipelineRun).filter(PipelineRun.id == uuid.UUID(run_id)).first()
        if run:
            run.status = "failed"
            run.error_message = message
            run.finished_at = datetime.now(timezone.utc)
        db.commit()
    except Exception as db_err:  # noqa: BLE001
        logger.error("Failed to persist failure state: %s", db_err)
        db.rollback()

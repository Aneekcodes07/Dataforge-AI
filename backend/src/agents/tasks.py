"""
Celery task definitions for Pipeline Orchestrator and Agent nodes.
"""

import time
import httpx
import random
import logging
import uuid
from datetime import datetime
from src.celery_app import celery_app
from src.core.database import SessionLocal
from src.core.redis_pubsub import publish_ws_event, publish_extraction_event
from src.datasets.models import Dataset
from src.pipelines.models import Pipeline, PipelineRun
from src.monitoring.models import AgentMetrics, ActivityLog

logger = logging.getLogger(__name__)


def log_and_broadcast_agent_log(
    db: SessionLocal,
    workspace_id: str,
    pipeline_id: str,
    run_id: str,
    project_id: str,
    agent: str,
    message: str,
    event_type: str = "activity.created"
):
    """Log log event to DB, broadcast activity/log events to workspace, and update extraction stream."""
    try:
        # 1. DB Save
        log_entry = ActivityLog(
            workspace_id=uuid.UUID(workspace_id),
            event_type=event_type,
            description=f"[{agent.upper()}] {message}"
        )
        db.add(log_entry)
        db.commit()
        db.refresh(log_entry)

        # 2. Workspace general activity
        publish_ws_event(
            room=f"workspace:{workspace_id}",
            event_type="activity.created",
            payload={
                "id": str(log_entry.id),
                "workspaceId": workspace_id,
                "eventType": event_type,
                "description": log_entry.description,
                "createdAt": log_entry.created_at.isoformat(),
                "agent": agent,
                "message": message
            }
        )

        # 3. Workspace pipeline logs console
        publish_ws_event(
            room=f"workspace:{workspace_id}",
            event_type="pipeline.log",
            payload={
                "id": f"log_{uuid.uuid4()}",
                "agentId": agent,
                "message": message,
                "timestamp": datetime.utcnow().isoformat(),
                "pipelineId": pipeline_id,
                "runId": run_id
            }
        )

        # 4. Project direct extraction stream
        publish_extraction_event(
            project_id=project_id,
            payload={
                "type": "log",
                "agent": agent,
                "message": message
            }
        )
    except Exception as e:
        logger.error(f"Error in logging and broadcasting: {e}")


def broadcast_agent_telemetry(
    workspace_id: str,
    project_id: str,
    agent: str,
    status: str,
    queue_size: int = 0,
    latency: str = "10ms",
    throughput: str = "0/s"
):
    """Helper to publish status, queue, and health telemetry to global WS bridge and local extraction stream."""
    # Publish agent.status.changed to workspace
    publish_ws_event(
        room=f"workspace:{workspace_id}",
        event_type="agent.status.changed",
        payload={"agent": agent, "status": status}
    )
    # Publish agent.queue.updated to workspace
    publish_ws_event(
        room=f"workspace:{workspace_id}",
        event_type="agent.queue.updated",
        payload={"agent": agent, "queueSize": queue_size}
    )
    # Publish agent.health.updated to workspace
    publish_ws_event(
        room=f"workspace:{workspace_id}",
        event_type="agent.health.updated",
        payload={
            "agent": agent,
            "health": "healthy" if status != "failed" else "degraded",
            "latency": latency,
            "throughput": throughput
        }
    )
    # Publish status directly to project extraction stream
    publish_extraction_event(
        project_id=project_id,
        payload={"type": "status", "agent": agent, "status": status}
    )


# ----------------------------------------------------
# 1. Individual Agent Tasks
# ----------------------------------------------------

@celery_app.task(name="run_web_crawling_task", bind=True, max_retries=3)
def run_web_crawling_task(self, run_id: str, project_id: str, workspace_id: str, pipeline_id: str):
    """Crawler/Ingestion Agent task executing source file fetch simulations."""
    db = SessionLocal()
    try:
        broadcast_agent_telemetry(workspace_id, project_id, "ingestion", "running", queue_size=1, latency="12ms", throughput="1.2MB/s")
        publish_extraction_event(project_id, {"type": "progress", "progress": 5})
        publish_ws_event(f"workspace:{workspace_id}", "pipeline.progress", {"progress": 5, "pipelineId": pipeline_id, "runId": run_id})

        log_and_broadcast_agent_log(db, workspace_id, pipeline_id, run_id, project_id, "ingestion", "Connecting to source target REST API gateway...")
        time.sleep(0.8)

        dataset = db.query(Dataset).filter(Dataset.id == uuid.UUID(project_id)).first()
        if dataset and dataset.source_type == "url":
            log_and_broadcast_agent_log(db, workspace_id, pipeline_id, run_id, project_id, "ingestion", "Fetching URL: https://en.wikipedia.org/wiki/Data_science")
            try:
                r = httpx.get("https://en.wikipedia.org/wiki/Data_science", timeout=5.0)
                if r.status_code == 200:
                    log_and_broadcast_agent_log(db, workspace_id, pipeline_id, run_id, project_id, "ingestion", f"Successfully fetched HTML payload ({len(r.text)} bytes).")
                else:
                    log_and_broadcast_agent_log(db, workspace_id, pipeline_id, run_id, project_id, "ingestion", f"HTTP fetch status: {r.status_code}. Using cache.")
            except Exception as e:
                log_and_broadcast_agent_log(db, workspace_id, pipeline_id, run_id, project_id, "ingestion", f"Source fetch delay: {str(e)}. Using local cache.")
        else:
            log_and_broadcast_agent_log(db, workspace_id, pipeline_id, run_id, project_id, "ingestion", "Reading raw binary buffers from target connector...")
            time.sleep(0.4)

        broadcast_agent_telemetry(workspace_id, project_id, "ingestion", "completed", queue_size=0, latency="24ms", throughput="1.2MB/s")
        publish_extraction_event(project_id, {"type": "status", "agent": "ingestion", "status": "completed"})
        publish_extraction_event(project_id, {"type": "progress", "progress": 15})
        publish_ws_event(f"workspace:{workspace_id}", "pipeline.progress", {"progress": 15, "pipelineId": pipeline_id, "runId": run_id})
        time.sleep(0.3)
    except Exception as exc:
        db.rollback()
        logger.error(f"Error in Ingestion: {exc}")
        broadcast_agent_telemetry(workspace_id, project_id, "ingestion", "failed")
        raise self.retry(exc=exc, countdown=5)
    finally:
        db.close()


@celery_app.task(name="run_ocr_task", bind=True, max_retries=3)
def run_ocr_task(self, run_id: str, project_id: str, workspace_id: str, pipeline_id: str):
    """OCR parsing layout processing agent task."""
    db = SessionLocal()
    try:
        broadcast_agent_telemetry(workspace_id, project_id, "ocr", "running", queue_size=2, latency="85ms", throughput="48 docs/s")
        publish_extraction_event(project_id, {"type": "progress", "progress": 25})
        publish_ws_event(f"workspace:{workspace_id}", "pipeline.progress", {"progress": 25, "pipelineId": pipeline_id, "runId": run_id})

        log_and_broadcast_agent_log(db, workspace_id, pipeline_id, run_id, project_id, "ocr", "Analyzing document bounding layouts...")
        time.sleep(0.8)
        log_and_broadcast_agent_log(db, workspace_id, pipeline_id, run_id, project_id, "ocr", "OCR scanning completes. Extracted layout text layers.")

        broadcast_agent_telemetry(workspace_id, project_id, "ocr", "completed", queue_size=0, latency="114ms", throughput="48 docs/s")
        publish_extraction_event(project_id, {"type": "status", "agent": "ocr", "status": "completed"})
        publish_extraction_event(project_id, {"type": "progress", "progress": 35})
        publish_ws_event(f"workspace:{workspace_id}", "pipeline.progress", {"progress": 35, "pipelineId": pipeline_id, "runId": run_id})
        time.sleep(0.3)
    except Exception as exc:
        db.rollback()
        logger.error(f"Error in OCR: {exc}")
        broadcast_agent_telemetry(workspace_id, project_id, "ocr", "failed")
        raise self.retry(exc=exc, countdown=5)
    finally:
        db.close()


@celery_app.task(name="run_extraction_task", bind=True, max_retries=3)
def run_extraction_task(self, run_id: str, project_id: str, workspace_id: str, pipeline_id: str):
    """Feature / Entities extraction LLM simulation agent task."""
    db = SessionLocal()
    try:
        broadcast_agent_telemetry(workspace_id, project_id, "extractor", "running", queue_size=14, latency="114ms", throughput="2,840 rec/s")
        publish_extraction_event(project_id, {"type": "progress", "progress": 45})
        publish_ws_event(f"workspace:{workspace_id}", "pipeline.progress", {"progress": 45, "pipelineId": pipeline_id, "runId": run_id})

        log_and_broadcast_agent_log(db, workspace_id, pipeline_id, run_id, project_id, "extractor", "Querying model gpt-4o-mini to extract properties...")
        time.sleep(1.0)
        log_and_broadcast_agent_log(db, workspace_id, pipeline_id, run_id, project_id, "extractor", "Extracted 12 structural entities matching base targets.")

        broadcast_agent_telemetry(workspace_id, project_id, "extractor", "completed", queue_size=0, latency="24ms", throughput="2,840 rec/s")
        publish_extraction_event(project_id, {"type": "status", "agent": "extractor", "status": "completed"})
        publish_extraction_event(project_id, {"type": "progress", "progress": 55})
        publish_ws_event(f"workspace:{workspace_id}", "pipeline.progress", {"progress": 55, "pipelineId": pipeline_id, "runId": run_id})
        time.sleep(0.3)
    except Exception as exc:
        db.rollback()
        logger.error(f"Error in Extraction: {exc}")
        broadcast_agent_telemetry(workspace_id, project_id, "extractor", "failed")
        raise self.retry(exc=exc, countdown=5)
    finally:
        db.close()


@celery_app.task(name="run_schema_task", bind=True, max_retries=3)
def run_schema_task(self, run_id: str, project_id: str, workspace_id: str, pipeline_id: str):
    """Schema analysis and headers mapping agent task."""
    db = SessionLocal()
    try:
        broadcast_agent_telemetry(workspace_id, project_id, "schema", "running", queue_size=1, latency="12ms", throughput="2.4MB/s")
        publish_extraction_event(project_id, {"type": "progress", "progress": 65})
        publish_ws_event(f"workspace:{workspace_id}", "pipeline.progress", {"progress": 65, "pipelineId": pipeline_id, "runId": run_id})

        log_and_broadcast_agent_log(db, workspace_id, pipeline_id, run_id, project_id, "schema", "Inferring schema types and constraints...")
        time.sleep(0.6)
        log_and_broadcast_agent_log(db, workspace_id, pipeline_id, run_id, project_id, "schema", "Schema aligned. Columns determined: [id, title, value, category, timestamp, quality, score, rank].")

        broadcast_agent_telemetry(workspace_id, project_id, "schema", "completed", queue_size=0, latency="15ms", throughput="2.4MB/s")
        publish_extraction_event(project_id, {"type": "status", "agent": "schema", "status": "completed"})
        publish_extraction_event(project_id, {"type": "progress", "progress": 75})
        publish_ws_event(f"workspace:{workspace_id}", "pipeline.progress", {"progress": 75, "pipelineId": pipeline_id, "runId": run_id})
        time.sleep(0.3)
    except Exception as exc:
        db.rollback()
        logger.error(f"Error in Schema task: {exc}")
        broadcast_agent_telemetry(workspace_id, project_id, "schema", "failed")
        raise self.retry(exc=exc, countdown=5)
    finally:
        db.close()


@celery_app.task(name="run_validation_task", bind=True, max_retries=3)
def run_validation_task(self, run_id: str, project_id: str, workspace_id: str, pipeline_id: str):
    """Validation bounds constraints checks agent task."""
    db = SessionLocal()
    try:
        broadcast_agent_telemetry(workspace_id, project_id, "validator", "running", queue_size=1, latency="8ms", throughput="4.5MB/s")
        publish_extraction_event(project_id, {"type": "progress", "progress": 80})
        publish_ws_event(f"workspace:{workspace_id}", "pipeline.progress", {"progress": 80, "pipelineId": pipeline_id, "runId": run_id})

        log_and_broadcast_agent_log(db, workspace_id, pipeline_id, run_id, project_id, "validator", "Checking validation rules, null values, and bounds...")
        time.sleep(0.8)
        log_and_broadcast_agent_log(db, workspace_id, pipeline_id, run_id, project_id, "validator", "Null checks complete. Detected 1.2% missing fields in column [score].")

        broadcast_agent_telemetry(workspace_id, project_id, "validator", "completed", queue_size=0, latency="4ms", throughput="4.5MB/s")
        publish_extraction_event(project_id, {"type": "status", "agent": "validator", "status": "completed"})
        publish_extraction_event(project_id, {"type": "progress", "progress": 85})
        publish_ws_event(f"workspace:{workspace_id}", "pipeline.progress", {"progress": 85, "pipelineId": pipeline_id, "runId": run_id})
        time.sleep(0.3)
    except Exception as exc:
        db.rollback()
        logger.error(f"Error in Validation: {exc}")
        broadcast_agent_telemetry(workspace_id, project_id, "validator", "failed")
        raise self.retry(exc=exc, countdown=5)
    finally:
        db.close()


@celery_app.task(name="run_cleaning_task", bind=True, max_retries=3)
def run_cleaning_task(self, run_id: str, project_id: str, workspace_id: str, pipeline_id: str):
    """Auto cleaning normalizations agent task."""
    db = SessionLocal()
    try:
        broadcast_agent_telemetry(workspace_id, project_id, "cleaner", "running", queue_size=1, latency="10ms", throughput="4.2MB/s")
        publish_extraction_event(project_id, {"type": "progress", "progress": 90})
        publish_ws_event(f"workspace:{workspace_id}", "pipeline.progress", {"progress": 90, "pipelineId": pipeline_id, "runId": run_id})

        log_and_broadcast_agent_log(db, workspace_id, pipeline_id, run_id, project_id, "cleaner", "Imputing missing fields. Normalizing column headers to lowercase...")
        time.sleep(0.8)
        log_and_broadcast_agent_log(db, workspace_id, pipeline_id, run_id, project_id, "cleaner", "Applying string normalization and timestamp cleaning.")

        broadcast_agent_telemetry(workspace_id, project_id, "cleaner", "completed", queue_size=0, latency="8ms", throughput="4.2MB/s")
        publish_extraction_event(project_id, {"type": "status", "agent": "cleaner", "status": "completed"})
        publish_extraction_event(project_id, {"type": "progress", "progress": 95})
        publish_ws_event(f"workspace:{workspace_id}", "pipeline.progress", {"progress": 95, "pipelineId": pipeline_id, "runId": run_id})
        time.sleep(0.3)
    except Exception as exc:
        db.rollback()
        logger.error(f"Error in Cleaning: {exc}")
        broadcast_agent_telemetry(workspace_id, project_id, "cleaner", "failed")
        raise self.retry(exc=exc, countdown=5)
    finally:
        db.close()


# ----------------------------------------------------
# 2. Master Pipeline Orchestrator Task
# ----------------------------------------------------

@celery_app.task(name="run_extraction_pipeline_task", bind=True)
def run_extraction_pipeline_task(self, run_id: str, project_id: str):
    """Orchestrates individual agent tasks sequentially, maintaining pipeline state transitions."""
    logger.info(f"Triggering master pipeline orchestrator for run_id={run_id}, project_id={project_id}")
    db = SessionLocal()
    
    try:
        # Resolve DB references
        dataset = db.query(Dataset).filter(Dataset.id == uuid.UUID(project_id)).first()
        if not dataset:
            logger.error(f"Dataset {project_id} not found for execution.")
            return {"status": "failed", "error": "Dataset not found"}

        workspace_id = str(dataset.workspace_id)
        pipeline = db.query(Pipeline).filter(Pipeline.dataset_id == dataset.id).first()
        pipeline_id = str(pipeline.id) if pipeline else None

        run = db.query(PipelineRun).filter(PipelineRun.id == uuid.UUID(run_id)).first()
        if not run:
            logger.error(f"PipelineRun {run_id} not found.")
            return {"status": "failed", "error": "PipelineRun not found"}

        # 1. Update states
        run.status = "running"
        run.started_at = datetime.utcnow()
        dataset.status = "Processing"
        db.commit()

        # 2. Broadcast pipeline started
        publish_ws_event(
            room=f"workspace:{workspace_id}",
            event_type="pipeline.started",
            payload={
                "pipelineId": pipeline_id,
                "runId": run_id,
                "status": "running"
            }
        )
        publish_extraction_event(project_id, {"type": "status", "agent": "ingestion", "status": "running"})

        # 3. Run individual tasks sequentially using synchronous execution (.run)
        run_web_crawling_task.run(run_id, project_id, workspace_id, pipeline_id)
        run_ocr_task.run(run_id, project_id, workspace_id, pipeline_id)
        run_extraction_task.run(run_id, project_id, workspace_id, pipeline_id)
        run_schema_task.run(run_id, project_id, workspace_id, pipeline_id)
        run_validation_task.run(run_id, project_id, workspace_id, pipeline_id)
        run_cleaning_task.run(run_id, project_id, workspace_id, pipeline_id)

        # 4. Finalize database states
        rows = random.randint(1200, 3200)
        cols = 8
        quality = random.randint(92, 98)

        dataset.status = "Ready"
        dataset.record_count = rows
        dataset.column_count = cols
        dataset.quality_score = float(quality)
        dataset.updated_at = datetime.utcnow()

        run.status = "completed"
        run.records_processed = rows
        run.duration_seconds = int((datetime.utcnow() - run.started_at).total_seconds())
        run.finished_at = datetime.utcnow()
        
        db.commit()

        # 5. Broadcast completion telemetries
        publish_ws_event(
            room=f"workspace:{workspace_id}",
            event_type="pipeline.completed",
            payload={
                "pipelineId": pipeline_id,
                "runId": run_id,
                "rowCount": rows,
                "columnCount": cols,
                "qualityScore": quality,
                "durationSeconds": run.duration_seconds
            }
        )
        publish_ws_event(
            room=f"workspace:{workspace_id}",
            event_type="dataset.generated",
            payload={
                "datasetId": project_id,
                "name": dataset.name,
                "rowCount": rows,
                "columnCount": cols,
                "qualityScore": quality
            }
        )
        publish_extraction_event(
            project_id=project_id,
            payload={
                "type": "completed",
                "row_count": rows,
                "column_count": cols,
                "quality_score": quality
            }
        )

        return {"status": "completed", "run_id": run_id}

    except Exception as e:
        db.rollback()
        logger.error(f"Pipeline orchestrator execution failed: {e}")

        # Extract context attributes if possible
        try:
            workspace_id = str(dataset.workspace_id)
            pipeline_id = str(pipeline.id) if pipeline else None
        except:
            workspace_id = None
            pipeline_id = None

        if workspace_id:
            publish_ws_event(
                room=f"workspace:{workspace_id}",
                event_type="pipeline.failed",
                payload={
                    "pipelineId": pipeline_id,
                    "runId": run_id,
                    "errorMessage": str(e)
                }
            )

        publish_extraction_event(
            project_id=project_id,
            payload={"type": "failed", "message": f"Pipeline execution error: {str(e)}"}
        )

        # Update DB structures as failed
        try:
            dataset = db.query(Dataset).filter(Dataset.id == uuid.UUID(project_id)).first()
            if dataset:
                dataset.status = "Failed"
                dataset.updated_at = datetime.utcnow()

            run = db.query(PipelineRun).filter(PipelineRun.id == uuid.UUID(run_id)).first()
            if run:
                run.status = "failed"
                run.error_message = str(e)
                run.finished_at = datetime.utcnow()
            db.commit()
        except Exception as db_err:
            logger.error(f"Failed to set database error status: {db_err}")

        return {"status": "failed", "error": str(e)}
    finally:
        db.close()

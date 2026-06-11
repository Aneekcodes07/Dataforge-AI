"""
Extraction Engine — Async task execution loop reporting live metrics via WebSockets and broadcasting to workspace channels.
"""

import asyncio
import random
import httpx
import logging
from datetime import datetime
from fastapi import WebSocket
from sqlalchemy.orm import Session

from src.core.database import SessionLocal
from src.datasets.models import Dataset
from src.pipelines.models import Pipeline, PipelineRun
from src.monitoring.models import AgentMetrics, ActivityLog
from src.core.websockets import ws_manager

logger = logging.getLogger(__name__)


async def broadcast_and_log(
    db: Session,
    workspace_id: str,
    pipeline_id: str,
    run_id: str,
    agent: str,
    message: str,
    event_type: str = "activity.created",
    ws: WebSocket = None
):
    """Log activity in database, broadcast to workspace, and update console log."""
    try:
        # 1. Save to Database
        log_entry = ActivityLog(
            workspace_id=datetime.utcnow() if not workspace_id else workspace_id,  # UUID check handled by DB conversion
            event_type=event_type,
            description=f"[{agent.upper()}] {message}"
        )
        # Handle valid UUID casting
        import uuid
        log_entry.workspace_id = uuid.UUID(workspace_id)
        db.add(log_entry)
        db.commit()
        db.refresh(log_entry)
        
        # 2. Prepare payload
        payload = {
            "id": str(log_entry.id),
            "workspaceId": workspace_id,
            "eventType": event_type,
            "description": log_entry.description,
            "createdAt": log_entry.created_at.isoformat(),
            "agent": agent,
            "message": message
        }

        # 3. Broadcast as activity.created
        await ws_manager.broadcast_to_workspace(workspace_id, "activity.created", payload)
        
        # 4. Broadcast as pipeline.log
        log_payload = {
            "id": f"log_{uuid.uuid4()}",
            "agentId": agent,
            "message": message,
            "timestamp": datetime.utcnow().isoformat(),
            "pipelineId": pipeline_id,
            "runId": run_id
        }
        await ws_manager.broadcast_to_workspace(workspace_id, "pipeline.log", log_payload)

        # 5. Direct socket fallback
        if ws:
            try:
                await ws.send_json({
                    "type": "log",
                    "agent": agent,
                    "message": message
                })
            except:
                pass
    except Exception as e:
        logger.error(f"Error in broadcast_and_log: {e}")


async def broadcast_agent_telemetry(workspace_id: str, agent: str, status: str, queue_size: int = 0, latency: str = "10ms", throughput: str = "0/s"):
    """Helper to broadcast agent status, queue depth, and health telemetry updates."""
    # agent.status.changed
    await ws_manager.broadcast_to_workspace(workspace_id, "agent.status.changed", {
        "agent": agent,
        "status": status
    })
    # agent.queue.updated
    await ws_manager.broadcast_to_workspace(workspace_id, "agent.queue.updated", {
        "agent": agent,
        "queueSize": queue_size
    })
    # agent.health.updated
    await ws_manager.broadcast_to_workspace(workspace_id, "agent.health.updated", {
        "agent": agent,
        "health": "healthy" if status != "failed" else "degraded",
        "latency": latency,
        "throughput": throughput
    })


async def run_extraction_pipeline(project_id: str, ws: WebSocket = None):
    """Run simulated ingestion pipeline and sync telemetry updates to database."""
    db: Session = SessionLocal()
    
    try:
        # 0. Find dataset configuration in database
        dataset = db.query(Dataset).filter(Dataset.id == project_id).first()
        if not dataset:
            if ws:
                await ws.send_json({"type": "failed", "message": "Dataset configuration not found"})
            return

        workspace_id = str(dataset.workspace_id)
        pipeline = db.query(Pipeline).filter(Pipeline.dataset_id == dataset.id).first()
        pipeline_id = str(pipeline.id) if pipeline else None

        # Create active run record
        run = PipelineRun(
            pipeline_id=pipeline_id,
            status="running",
            started_at=datetime.utcnow(),
        )
        db.add(run)
        db.commit()
        db.refresh(run)
        run_id = str(run.id)

        # Update dataset status
        dataset.status = "Processing"
        db.commit()

        # Broadcast pipeline started
        await ws_manager.broadcast_to_workspace(workspace_id, "pipeline.started", {
            "pipelineId": pipeline_id,
            "runId": run_id,
            "status": "running"
        })
        if ws:
            try:
                await ws.send_json({"type": "status", "agent": "ingestion", "status": "running"})
            except:
                pass

        # 1. Ingestion Agent
        await broadcast_agent_telemetry(workspace_id, "ingestion", "running", queue_size=1, latency="12ms", throughput="1.2MB/s")
        await ws_manager.broadcast_to_workspace(workspace_id, "pipeline.progress", {"progress": 5, "pipelineId": pipeline_id, "runId": run_id})
        if ws:
            try:
                await ws.send_json({"type": "progress", "progress": 5})
            except:
                pass
        
        await broadcast_and_log(db, workspace_id, pipeline_id, run_id, "ingestion", "Connecting to source target REST API gateway...", ws=ws)
        await asyncio.sleep(0.8)

        if dataset.source_type == "url":
            await broadcast_and_log(db, workspace_id, pipeline_id, run_id, "ingestion", "Fetching URL: https://en.wikipedia.org/wiki/Data_science", ws=ws)
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    r = await client.get("https://en.wikipedia.org/wiki/Data_science")
                    if r.status_code == 200:
                        await broadcast_and_log(db, workspace_id, pipeline_id, run_id, "ingestion", f"Successfully fetched HTML payload ({len(r.text)} bytes).", ws=ws)
                    else:
                        await broadcast_and_log(db, workspace_id, pipeline_id, run_id, "ingestion", f"HTTP fetch status: {r.status_code}. Using cache.", ws=ws)
            except Exception as e:
                await broadcast_and_log(db, workspace_id, pipeline_id, run_id, "ingestion", f"Source fetch delay: {str(e)}. Using local cache.", ws=ws)
        else:
            await broadcast_and_log(db, workspace_id, pipeline_id, run_id, "ingestion", "Reading raw binary buffers from target connector...", ws=ws)
            await asyncio.sleep(0.4)

        await broadcast_agent_telemetry(workspace_id, "ingestion", "completed", queue_size=0, latency="24ms", throughput="1.2MB/s")
        await ws_manager.broadcast_to_workspace(workspace_id, "pipeline.progress", {"progress": 15, "pipelineId": pipeline_id, "runId": run_id})
        if ws:
            try:
                await ws.send_json({"type": "status", "agent": "ingestion", "status": "completed"})
                await ws.send_json({"type": "progress", "progress": 15})
            except:
                pass
        await asyncio.sleep(0.3)

        # 2. OCR / Parsing Agent
        await broadcast_agent_telemetry(workspace_id, "ocr", "running", queue_size=2, latency="85ms", throughput="48 docs/s")
        await ws_manager.broadcast_to_workspace(workspace_id, "pipeline.progress", {"progress": 25, "pipelineId": pipeline_id, "runId": run_id})
        if ws:
            try:
                await ws.send_json({"type": "status", "agent": "ocr", "status": "running"})
                await ws.send_json({"type": "progress", "progress": 25})
            except:
                pass
        await broadcast_and_log(db, workspace_id, pipeline_id, run_id, "ocr", "Analyzing document bounding layouts...", ws=ws)
        await asyncio.sleep(0.8)
        await broadcast_and_log(db, workspace_id, pipeline_id, run_id, "ocr", "OCR scanning completes. Extracted layout text layers.", ws=ws)
        
        await broadcast_agent_telemetry(workspace_id, "ocr", "completed", queue_size=0, latency="114ms", throughput="48 docs/s")
        await ws_manager.broadcast_to_workspace(workspace_id, "pipeline.progress", {"progress": 35, "pipelineId": pipeline_id, "runId": run_id})
        if ws:
            try:
                await ws.send_json({"type": "status", "agent": "ocr", "status": "completed"})
                await ws.send_json({"type": "progress", "progress": 35})
            except:
                pass
        await asyncio.sleep(0.3)

        # 3. Extractor Agent
        await broadcast_agent_telemetry(workspace_id, "extractor", "running", queue_size=14, latency="114ms", throughput="2,840 rec/s")
        await ws_manager.broadcast_to_workspace(workspace_id, "pipeline.progress", {"progress": 45, "pipelineId": pipeline_id, "runId": run_id})
        if ws:
            try:
                await ws.send_json({"type": "status", "agent": "extractor", "status": "running"})
                await ws.send_json({"type": "progress", "progress": 45})
            except:
                pass
        await broadcast_and_log(db, workspace_id, pipeline_id, run_id, "extractor", "Querying model gpt-4o-mini to extract properties...", ws=ws)
        await asyncio.sleep(1.0)
        await broadcast_and_log(db, workspace_id, pipeline_id, run_id, "extractor", "Extracted 12 structural entities matching base targets.", ws=ws)
        
        await broadcast_agent_telemetry(workspace_id, "extractor", "completed", queue_size=0, latency="24ms", throughput="2,840 rec/s")
        await ws_manager.broadcast_to_workspace(workspace_id, "pipeline.progress", {"progress": 55, "pipelineId": pipeline_id, "runId": run_id})
        if ws:
            try:
                await ws.send_json({"type": "status", "agent": "extractor", "status": "completed"})
                await ws.send_json({"type": "progress", "progress": 55})
            except:
                pass
        await asyncio.sleep(0.3)

        # 4. Schema Agent
        await broadcast_agent_telemetry(workspace_id, "schema", "running", queue_size=1, latency="12ms", throughput="2.4MB/s")
        await ws_manager.broadcast_to_workspace(workspace_id, "pipeline.progress", {"progress": 65, "pipelineId": pipeline_id, "runId": run_id})
        if ws:
            try:
                await ws.send_json({"type": "status", "agent": "schema", "status": "running"})
                await ws.send_json({"type": "progress", "progress": 65})
            except:
                pass
        await broadcast_and_log(db, workspace_id, pipeline_id, run_id, "schema", "Inferring schema types and constraints...", ws=ws)
        await asyncio.sleep(0.6)
        await broadcast_and_log(db, workspace_id, pipeline_id, run_id, "schema", "Schema aligned. Columns determined: [id, title, value, category, timestamp, quality, score, rank].", ws=ws)
        
        await broadcast_agent_telemetry(workspace_id, "schema", "completed", queue_size=0, latency="15ms", throughput="2.4MB/s")
        await ws_manager.broadcast_to_workspace(workspace_id, "pipeline.progress", {"progress": 75, "pipelineId": pipeline_id, "runId": run_id})
        if ws:
            try:
                await ws.send_json({"type": "status", "agent": "schema", "status": "completed"})
                await ws.send_json({"type": "progress", "progress": 75})
            except:
                pass
        await asyncio.sleep(0.3)

        # 5. Validator Agent
        await broadcast_agent_telemetry(workspace_id, "validator", "running", queue_size=1, latency="8ms", throughput="4.5MB/s")
        await ws_manager.broadcast_to_workspace(workspace_id, "pipeline.progress", {"progress": 80, "pipelineId": pipeline_id, "runId": run_id})
        if ws:
            try:
                await ws.send_json({"type": "status", "agent": "validator", "status": "running"})
                await ws.send_json({"type": "progress", "progress": 80})
            except:
                pass
        await broadcast_and_log(db, workspace_id, pipeline_id, run_id, "validator", "Checking validation rules, null values, and bounds...", ws=ws)
        await asyncio.sleep(0.8)
        await broadcast_and_log(db, workspace_id, pipeline_id, run_id, "validator", "Null checks complete. Detected 1.2% missing fields in column [score].", ws=ws)
        
        await broadcast_agent_telemetry(workspace_id, "validator", "completed", queue_size=0, latency="4ms", throughput="4.5MB/s")
        await ws_manager.broadcast_to_workspace(workspace_id, "pipeline.progress", {"progress": 85, "pipelineId": pipeline_id, "runId": run_id})
        if ws:
            try:
                await ws.send_json({"type": "status", "agent": "validator", "status": "completed"})
                await ws.send_json({"type": "progress", "progress": 85})
            except:
                pass
        await asyncio.sleep(0.3)

        # 6. Cleaner Agent
        await broadcast_agent_telemetry(workspace_id, "cleaner", "running", queue_size=1, latency="10ms", throughput="4.2MB/s")
        await ws_manager.broadcast_to_workspace(workspace_id, "pipeline.progress", {"progress": 90, "pipelineId": pipeline_id, "runId": run_id})
        if ws:
            try:
                await ws.send_json({"type": "status", "agent": "cleaner", "status": "running"})
                await ws.send_json({"type": "progress", "progress": 90})
            except:
                pass
        await broadcast_and_log(db, workspace_id, pipeline_id, run_id, "cleaner", "Imputing missing fields. Normalizing column headers to lowercase...", ws=ws)
        await asyncio.sleep(0.8)
        await broadcast_and_log(db, workspace_id, pipeline_id, run_id, "cleaner", "Applying string normalization and timestamp cleaning.", ws=ws)
        
        await broadcast_agent_telemetry(workspace_id, "cleaner", "completed", queue_size=0, latency="8ms", throughput="4.2MB/s")
        await ws_manager.broadcast_to_workspace(workspace_id, "pipeline.progress", {"progress": 95, "pipelineId": pipeline_id, "runId": run_id})
        if ws:
            try:
                await ws.send_json({"type": "status", "agent": "cleaner", "status": "completed"})
                await ws.send_json({"type": "progress", "progress": 95})
            except:
                pass
        await asyncio.sleep(0.3)

        # Finalize project status
        rows = random.randint(1200, 3200)
        cols = 8
        quality = random.randint(92, 98)

        # Update dataset parameters in DB
        dataset.status = "Ready"
        dataset.record_count = rows
        dataset.column_count = cols
        dataset.quality_score = float(quality)
        dataset.updated_at = datetime.utcnow()

        # Update PipelineRun status
        run.status = "completed"
        run.records_processed = rows
        run.duration_seconds = int((datetime.utcnow() - run.started_at).total_seconds())
        run.finished_at = datetime.utcnow()
        
        db.commit()

        # Broadcast completion events
        await ws_manager.broadcast_to_workspace(workspace_id, "pipeline.completed", {
            "pipelineId": pipeline_id,
            "runId": run_id,
            "rowCount": rows,
            "columnCount": cols,
            "qualityScore": quality,
            "durationSeconds": run.duration_seconds
        })

        await ws_manager.broadcast_to_workspace(workspace_id, "dataset.generated", {
            "datasetId": project_id,
            "name": dataset.name,
            "rowCount": rows,
            "columnCount": cols,
            "qualityScore": quality
        })

        if ws:
            try:
                await ws.send_json({
                    "type": "completed",
                    "row_count": rows,
                    "column_count": cols,
                    "quality_score": quality
                })
            except:
                pass

    except Exception as e:
        logger.error(f"Pipeline execution failed: {e}")
        
        # Resolve details if possible
        try:
            workspace_id = str(dataset.workspace_id)
            pipeline_id = str(pipeline.id) if pipeline else None
            run_id = str(run.id) if run else None
        except:
            workspace_id = None
            pipeline_id = None
            run_id = None

        if workspace_id:
            await ws_manager.broadcast_to_workspace(workspace_id, "pipeline.failed", {
                "pipelineId": pipeline_id,
                "runId": run_id,
                "errorMessage": str(e)
            })

        if ws:
            try:
                await ws.send_json({"type": "failed", "message": f"Pipeline execution error: {str(e)}"})
            except:
                pass
        
        if dataset:
            dataset.status = "Failed"
            dataset.updated_at = datetime.utcnow()
        
        if run:
            run.status = "failed"
            run.error_message = str(e)
            run.finished_at = datetime.utcnow()
        
        db.commit()
    finally:
        db.close()

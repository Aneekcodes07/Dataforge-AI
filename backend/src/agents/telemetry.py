"""Agent telemetry broadcasting.

Emits the WebSocket/Redis events the frontend consumes. The event names and
payload shapes here are a stable contract with the frontend (agentStore and the
extraction stream) and must not change without a coordinated UI update.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from src.core.redis_pubsub import publish_extraction_event, publish_ws_event
from src.monitoring.models import ActivityLog

logger = logging.getLogger(__name__)


def log_and_broadcast_agent_log(
    db: Session,
    workspace_id: str,
    pipeline_id: str | None,
    run_id: str,
    project_id: str,
    agent: str,
    message: str,
    event_type: str = "activity.created",
) -> None:
    """Persist a log line and broadcast it to activity feed, console, and stream."""
    try:
        log_entry = ActivityLog(
            workspace_id=uuid.UUID(workspace_id),
            event_type=event_type,
            description=f"[{agent.upper()}] {message}",
        )
        db.add(log_entry)
        db.commit()
        db.refresh(log_entry)

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
                "message": message,
            },
        )
        publish_ws_event(
            room=f"workspace:{workspace_id}",
            event_type="pipeline.log",
            payload={
                "id": f"log_{uuid.uuid4()}",
                "agentId": agent,
                "message": message,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "pipelineId": pipeline_id,
                "runId": run_id,
            },
        )
        publish_extraction_event(
            project_id=project_id,
            payload={"type": "log", "agent": agent, "message": message},
        )
    except Exception as exc:  # noqa: BLE001 - telemetry must not break the pipeline
        logger.error("Error in logging and broadcasting: %s", exc)


def broadcast_agent_telemetry(
    workspace_id: str,
    project_id: str,
    agent: str,
    status: str,
    queue_size: int = 0,
    latency: str = "10ms",
    throughput: str = "0/s",
) -> None:
    """Publish status, queue, and health telemetry for an agent."""
    publish_ws_event(
        room=f"workspace:{workspace_id}",
        event_type="agent.status.changed",
        payload={"agent": agent, "status": status},
    )
    publish_ws_event(
        room=f"workspace:{workspace_id}",
        event_type="agent.queue.updated",
        payload={"agent": agent, "queueSize": queue_size},
    )
    publish_ws_event(
        room=f"workspace:{workspace_id}",
        event_type="agent.health.updated",
        payload={
            "agent": agent,
            "health": "healthy" if status != "failed" else "degraded",
            "latency": latency,
            "throughput": throughput,
        },
    )
    publish_extraction_event(
        project_id=project_id,
        payload={"type": "status", "agent": agent, "status": status},
    )

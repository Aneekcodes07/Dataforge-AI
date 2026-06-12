from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import json
import uuid
from datetime import datetime
import redis.asyncio as aioredis
from src.core.database import SessionLocal
from src.core.config import get_settings
from src.datasets.models import Dataset
from src.pipelines.models import Pipeline, PipelineRun
from src.agents.tasks import run_extraction_pipeline_task
from src.core.security import decode_token
from src.auth.models import WorkspaceMembership

router = APIRouter()
settings = get_settings()


@router.websocket("/ws/{project_id}")
async def websocket_endpoint(websocket: WebSocket, project_id: str):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.accept()
        await websocket.send_json(
            {"type": "failed", "message": "Authentication token missing"}
        )
        await websocket.close(code=4008)
        return

    try:
        payload = decode_token(token)
        user_id = payload.get("sub")
        token_type = payload.get("type")
        if not user_id or token_type != "access":
            await websocket.accept()
            await websocket.send_json(
                {"type": "failed", "message": "Invalid authentication token"}
            )
            await websocket.close(code=4008)
            return
    except Exception as e:
        await websocket.accept()
        await websocket.send_json(
            {"type": "failed", "message": f"Authentication failed: {str(e)}"}
        )
        await websocket.close(code=4008)
        return

    await websocket.accept()

    db = SessionLocal()
    pubsub = None
    try:
        project_uuid = uuid.UUID(project_id)
        dataset = db.query(Dataset).filter(Dataset.id == project_uuid).first()
        if not dataset:
            await websocket.send_json(
                {"type": "failed", "message": "Dataset configuration not found"}
            )
            await websocket.close()
            return

        # Verify that user belongs to the workspace owning this project (BOLA fix)
        user_uuid = uuid.UUID(user_id)
        membership = (
            db.query(WorkspaceMembership)
            .filter(
                WorkspaceMembership.workspace_id == dataset.workspace_id,
                WorkspaceMembership.user_id == user_uuid,
            )
            .first()
        )
        if not membership:
            await websocket.send_json(
                {"type": "failed", "message": "Unauthorized workspace credentials"}
            )
            await websocket.close(code=4008)
            return

        pipeline = db.query(Pipeline).filter(Pipeline.dataset_id == dataset.id).first()
        pipeline_id = str(pipeline.id) if pipeline else None

        # Create a new run record
        run = PipelineRun(
            pipeline_id=pipeline_id,
            status="queued",
            created_at=datetime.utcnow(),
        )
        db.add(run)
        db.commit()
        db.refresh(run)

        # Trigger background execution in Celery
        run_extraction_pipeline_task.delay(str(run.id), project_id)

        # Subscribe to Redis Pub/Sub channel for streaming progress
        pubsub_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        pubsub = pubsub_client.pubsub()
        await pubsub.subscribe(f"extraction_stream:{project_id}")

        async for message in pubsub.listen():
            if message["type"] == "message":
                await websocket.send_text(message["data"])

                # Check for terminal status
                try:
                    payload = json.loads(message["data"])
                    if payload.get("type") in ("completed", "failed"):
                        break
                except Exception:
                    pass
    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json(
                {"type": "failed", "message": f"Server error: {str(e)}"}
            )
        except Exception:
            pass
    finally:
        db.close()
        if pubsub:
            try:
                await pubsub.unsubscribe(f"extraction_stream:{project_id}")
            except Exception:
                pass

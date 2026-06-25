from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
)
import json
import uuid
from datetime import datetime
import redis.asyncio as aioredis
from src.core.database import SessionLocal, get_db
from src.core.config import get_settings
from src.datasets.models import Dataset, SourceFile
from src.pipelines.models import Pipeline, PipelineRun
from src.agents.tasks import run_extraction_pipeline_task
from src.core.security import decode_token
from src.auth.models import User, WorkspaceMembership
from src.auth.router import get_current_user
from src.datasets.router import get_storage
from src.ai.llm import ProviderNotConfiguredError, get_gateway
from src.extraction.preview import preview_source
from src.extraction.types import ExtractionError
from src.ingestion.source import SourceConfigError
from src.processing.base import ProcessingError
from src.storage import ObjectStore

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


@router.post("/{dataset_id}/preview")
def preview_extraction(
    dataset_id: str,
    current_user: User = Depends(get_current_user),
    db=Depends(get_db),
    store: ObjectStore = Depends(get_storage),
):
    """Synchronously preview a dataset's source: inferred schema, sample rows,
    and a preliminary quality score (no full run, no artifact written).
    """
    try:
        ds_uuid = uuid.UUID(dataset_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid dataset ID format")

    membership = (
        db.query(WorkspaceMembership)
        .filter(WorkspaceMembership.user_id == current_user.id)
        .first()
    )
    if not membership:
        raise HTTPException(status_code=403, detail="User has no workspace")

    dataset = (
        db.query(Dataset)
        .filter(Dataset.id == ds_uuid, Dataset.workspace_id == membership.workspace_id)
        .first()
    )
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    pipeline = db.query(Pipeline).filter(Pipeline.dataset_id == dataset.id).first()
    config = (pipeline.run_configuration if pipeline else None) or {}
    source_file = (
        db.query(SourceFile)
        .filter(SourceFile.dataset_id == dataset.id)
        .order_by(SourceFile.created_at.desc())
        .first()
    )

    try:
        gateway = get_gateway()
    except ProviderNotConfiguredError:
        gateway = None

    try:
        return preview_source(
            dataset.source_type or "",
            config,
            store=store,
            source_file=source_file,
            gateway=gateway,
        )
    except (SourceConfigError, ExtractionError, ProcessingError) as exc:
        raise HTTPException(status_code=400, detail=str(exc))

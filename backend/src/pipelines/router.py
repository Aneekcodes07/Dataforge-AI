"""
Pipelines router — pipeline configurations and history logs endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
import uuid

from src.core.database import get_db
from src.auth.router import get_current_user
from src.auth.models import User, WorkspaceMembership
from src.pipelines.models import Pipeline, PipelineRun
from src.pipelines.schemas import PipelineResponse, PipelineRunResponse, PipelineCreate

router = APIRouter()


@router.get("/", response_model=list[PipelineResponse])
def list_pipelines(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve all pipeline configs in user's active workspace."""
    membership = db.query(WorkspaceMembership).filter(WorkspaceMembership.user_id == current_user.id).first()
    if not membership:
        return []

    pipelines = db.query(Pipeline).filter(Pipeline.workspace_id == membership.workspace_id).all()
    return [
        PipelineResponse(
            id=str(p.id),
            workspace_id=str(p.workspace_id),
            dataset_id=str(p.dataset_id) if p.dataset_id else None,
            name=p.name,
            description=p.description,
            status=p.status,
            cron_schedule=p.cron_schedule,
            run_configuration=p.run_configuration or {},
            created_at=p.created_at,
            updated_at=p.updated_at,
        )
        for p in pipelines
    ]


@router.post("/", response_model=PipelineResponse, status_code=status.HTTP_201_CREATED)
def create_pipeline(
    payload: PipelineCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Register a new pipeline specification."""
    membership = db.query(WorkspaceMembership).filter(WorkspaceMembership.user_id == current_user.id).first()
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User does not belong to any workspace",
        )

    pipeline = Pipeline(
        workspace_id=membership.workspace_id,
        dataset_id=uuid.UUID(payload.dataset_id),
        name=payload.name,
        description=payload.description,
        status="Idle",
        cron_schedule=payload.cron_schedule,
        run_configuration=payload.run_configuration,
        owner_id=current_user.id,
    )
    db.add(pipeline)
    db.commit()
    db.refresh(pipeline)

    return PipelineResponse(
        id=str(pipeline.id),
        workspace_id=str(pipeline.workspace_id),
        dataset_id=str(pipeline.dataset_id),
        name=pipeline.name,
        description=pipeline.description,
        status=pipeline.status,
        cron_schedule=pipeline.cron_schedule,
        run_configuration=pipeline.run_configuration or {},
        created_at=pipeline.created_at,
        updated_at=pipeline.updated_at,
    )


@router.get("/runs", response_model=list[PipelineRunResponse])
def list_runs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve history of all execution runs within user's workspace."""
    membership = db.query(WorkspaceMembership).filter(WorkspaceMembership.user_id == current_user.id).first()
    if not membership:
        return []

    # Get runs belonging to pipelines in user's workspace
    runs = db.query(PipelineRun).join(Pipeline).filter(
        Pipeline.workspace_id == membership.workspace_id
    ).order_by(PipelineRun.created_at.desc()).all()

    return [
        PipelineRunResponse(
            id=str(r.id),
            pipeline_id=str(r.pipeline_id),
            status=r.status,
            triggered_by=str(r.triggered_by) if r.triggered_by else None,
            duration_seconds=r.duration_seconds,
            records_processed=r.records_processed,
            error_message=r.error_message,
            logs_path=r.logs_path,
            created_at=r.created_at,
            started_at=r.started_at,
            finished_at=r.finished_at,
        )
        for r in runs
    ]


@router.post("/{pipeline_id}/run", response_model=PipelineRunResponse)
def trigger_pipeline(
    pipeline_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Manually enqueue an ingestion run task."""
    try:
        pipeline_uuid = uuid.UUID(pipeline_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid pipeline ID format")
    membership = db.query(WorkspaceMembership).filter(WorkspaceMembership.user_id == current_user.id).first()
    if not membership:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User does not belong to any workspace")

    pipeline = db.query(Pipeline).filter(
        Pipeline.id == pipeline_uuid,
        Pipeline.workspace_id == membership.workspace_id
    ).first()
    if not pipeline:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pipeline not found")

    # Initialize and queue run in Celery
    run = PipelineRun(
        pipeline_id=pipeline.id,
        status="queued",
        triggered_by=current_user.id,
        created_at=datetime.utcnow(),
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    # Queue the Celery task
    from src.agents.tasks import run_extraction_pipeline_task
    run_extraction_pipeline_task.delay(str(run.id), str(pipeline.dataset_id))

    return PipelineRunResponse(
        id=str(run.id),
        pipeline_id=str(run.pipeline_id),
        status=run.status,
        triggered_by=str(run.triggered_by),
        duration_seconds=run.duration_seconds,
        records_processed=run.records_processed,
        error_message=run.error_message,
        logs_path=run.logs_path,
        created_at=run.created_at,
        started_at=run.started_at,
        finished_at=run.finished_at,
    )

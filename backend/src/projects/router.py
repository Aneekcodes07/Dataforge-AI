"""
Projects/Datasets router — workspace dataset listing and wizard pipeline trigger endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from src.core.database import get_db
from src.auth.router import get_current_user
from src.auth.models import User, WorkspaceMembership
from src.datasets.models import Dataset
from src.pipelines.models import Pipeline
from src.projects.schemas import ProjectResponse, ProjectCreate
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/", response_model=list[ProjectResponse])
def list_projects(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Retrieve all datasets in the user's active workspace context."""
    membership = (
        db.query(WorkspaceMembership)
        .filter(WorkspaceMembership.user_id == current_user.id)
        .first()
    )
    if not membership:
        return []

    datasets = (
        db.query(Dataset)
        .filter(Dataset.workspace_id == membership.workspace_id)
        .order_by(Dataset.created_at.desc())
        .all()
    )

    return [
        ProjectResponse(
            id=str(d.id),
            name=d.name,
            source_type=d.source_type or "url",
            status=d.status.lower(),  # frontend expects 'completed', 'in_progress', etc.
            row_count=d.record_count,
            column_count=d.column_count,
            quality_score=float(d.quality_score),
            last_modified=d.updated_at,
        )
        for d in datasets
    ]


@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    project: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new dataset record and ingestion pipeline specification."""
    membership = (
        db.query(WorkspaceMembership)
        .filter(WorkspaceMembership.user_id == current_user.id)
        .first()
    )
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User does not belong to any workspace",
        )

    logger.info(f"Creating project '{project.name}' for user: {current_user.email}")

    # 1. Create dataset entry
    dataset = Dataset(
        workspace_id=membership.workspace_id,
        name=project.name,
        source_type=project.source_type,
        status="Empty",
        record_count=0,
        column_count=0,
        quality_score=0.00,
        owner_id=current_user.id,
    )
    db.add(dataset)
    db.flush()

    # 2. Create default Pipeline
    pipeline = Pipeline(
        workspace_id=membership.workspace_id,
        dataset_id=dataset.id,
        name=f"Ingestion for {project.name}",
        status="Idle",
        run_configuration=project.config,
        owner_id=current_user.id,
    )
    db.add(pipeline)

    db.commit()
    db.refresh(dataset)

    return ProjectResponse(
        id=str(dataset.id),
        name=dataset.name,
        source_type=dataset.source_type or "url",
        status=dataset.status.lower(),
        row_count=dataset.record_count,
        column_count=dataset.column_count,
        quality_score=float(dataset.quality_score),
        last_modified=dataset.updated_at,
    )


@router.delete("/{project_id}", status_code=status.HTTP_200_OK)
def delete_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete database records for the selected dataset."""
    membership = (
        db.query(WorkspaceMembership)
        .filter(WorkspaceMembership.user_id == current_user.id)
        .first()
    )
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized workspace credentials",
        )

    # Find the dataset
    import uuid

    try:
        project_uuid = uuid.UUID(project_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid dataset ID format",
        )

    dataset = (
        db.query(Dataset)
        .filter(
            Dataset.id == project_uuid, Dataset.workspace_id == membership.workspace_id
        )
        .first()
    )

    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found",
        )

    db.delete(dataset)
    db.commit()

    return {"status": "success", "message": "Dataset and linked configurations deleted"}

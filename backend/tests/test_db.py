"""
Database integration tests verifying UUIDs, check constraints, soft deletes, and cascading behaviors.
"""

import pytest
import uuid
from datetime import datetime
from sqlalchemy.exc import IntegrityError
from src.core.database import SessionLocal, Base, engine
from src.auth.models import User, Workspace, WorkspaceMembership, Team
from src.datasets.models import Dataset
from src.pipelines.models import Pipeline, PipelineRun
from src.monitoring.models import AgentMetrics, Notification, ActivityLog, AuditEvent


@pytest.fixture(scope="function")
def db():
    """Setup and teardown a clean database for each test function."""
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


def test_uuid_generation_and_pks(db):
    """Verify that models generate valid UUID primary keys on creation."""
    user = User(
        name="Test User",
        email="uuid_test@dataforge.ai",
        hashed_password="hashedpassword123"
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    assert isinstance(user.id, uuid.UUID)
    assert user.is_deleted is False
    assert user.deleted_at is None


def test_check_constraints_quality_score(db):
    """Verify quality_score CheckConstraint (0.00 to 100.00) in Dataset."""
    workspace = Workspace(name="Test Workspace")
    db.add(workspace)
    db.flush()

    # Valid quality score
    dataset_valid = Dataset(
        workspace_id=workspace.id,
        name="Valid Dataset",
        quality_score=95.50
    )
    db.add(dataset_valid)
    db.commit()

    # Invalid quality score (> 100)
    dataset_invalid = Dataset(
        workspace_id=workspace.id,
        name="Invalid Dataset",
        quality_score=105.00
    )
    db.add(dataset_invalid)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()

    # Invalid quality score (< 0)
    dataset_invalid_neg = Dataset(
        workspace_id=workspace.id,
        name="Invalid Dataset Negative",
        quality_score=-5.00
    )
    db.add(dataset_invalid_neg)
    with pytest.raises(IntegrityError):
        db.commit()


def test_check_constraints_pipeline_run(db):
    """Verify negative constraints on PipelineRun fields."""
    workspace = Workspace(name="ETL Workspace")
    db.add(workspace)
    db.flush()

    pipeline = Pipeline(
        workspace_id=workspace.id,
        name="ETL Pipeline"
    )
    db.add(pipeline)
    db.flush()

    # Negative duration
    run_invalid_duration = PipelineRun(
        pipeline_id=pipeline.id,
        duration_seconds=-10,
        records_processed=100
    )
    db.add(run_invalid_duration)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()

    # Negative records processed
    run_invalid_records = PipelineRun(
        pipeline_id=pipeline.id,
        duration_seconds=10,
        records_processed=-50
    )
    db.add(run_invalid_records)
    with pytest.raises(IntegrityError):
        db.commit()


def test_check_constraints_agent_metrics(db):
    """Verify AgentMetrics CPU range check and non-negative throughput constraints."""
    workspace = Workspace(name="Metrics Workspace")
    db.add(workspace)
    db.flush()

    pipeline = Pipeline(workspace_id=workspace.id, name="Metrics Pipeline")
    db.add(pipeline)
    db.flush()

    run = PipelineRun(pipeline_id=pipeline.id)
    db.add(run)
    db.flush()

    # Invalid CPU (> 100)
    metric_invalid_cpu = AgentMetrics(
        run_id=run.id,
        agent_type="OCR",
        cpu_percentage=120.00
    )
    db.add(metric_invalid_cpu)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()

    # Negative throughput
    metric_invalid_throughput = AgentMetrics(
        run_id=run.id,
        agent_type="OCR",
        throughput=-1.50
    )
    db.add(metric_invalid_throughput)
    with pytest.raises(IntegrityError):
        db.commit()


def test_cascading_deletes(db):
    """Verify cascading deletes for workspace-owned models."""
    workspace = Workspace(name="Cascade Workspace")
    db.add(workspace)
    db.flush()

    team = Team(workspace_id=workspace.id, name="Cascade Team")
    dataset = Dataset(workspace_id=workspace.id, name="Cascade Dataset")
    pipeline = Pipeline(workspace_id=workspace.id, name="Cascade Pipeline")
    
    db.add_all([team, dataset, pipeline])
    db.commit()

    # Verify workspace has dependencies
    assert db.query(Team).filter(Team.workspace_id == workspace.id).count() == 1
    assert db.query(Dataset).filter(Dataset.workspace_id == workspace.id).count() == 1
    assert db.query(Pipeline).filter(Pipeline.workspace_id == workspace.id).count() == 1

    # Delete workspace
    db.delete(workspace)
    db.commit()

    # Verify cascading deletes clean up dependents
    assert db.query(Team).filter(Team.workspace_id == workspace.id).count() == 0
    assert db.query(Dataset).filter(Dataset.workspace_id == workspace.id).count() == 0
    assert db.query(Pipeline).filter(Pipeline.workspace_id == workspace.id).count() == 0


def test_soft_deletes(db):
    """Verify soft delete functionality on entity models."""
    workspace = Workspace(name="Soft Delete Workspace")
    db.add(workspace)
    db.commit()

    # Verify active
    active_workspace = db.query(Workspace).filter(
        Workspace.id == workspace.id,
        Workspace.is_deleted == False
    ).first()
    assert active_workspace is not None

    # Perform soft delete
    workspace.is_deleted = True
    workspace.deleted_at = datetime.utcnow()
    db.commit()

    # Verify excluded from active search
    soft_deleted_workspace = db.query(Workspace).filter(
        Workspace.id == workspace.id,
        Workspace.is_deleted == False
    ).first()
    assert soft_deleted_workspace is None

    # Verify still exists in database (not hard deleted)
    db_record = db.query(Workspace).filter(Workspace.id == workspace.id).first()
    assert db_record is not None
    assert db_record.is_deleted is True

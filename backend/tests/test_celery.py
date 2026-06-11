"""
Celery integration and worker tests verifying task routing, health checks, and execution states.
"""

import pytest
import uuid
from datetime import datetime
from src.celery_app import celery_app
from src.core.database import SessionLocal, Base, engine
from src.auth.models import User, Workspace, WorkspaceMembership
from src.datasets.models import Dataset
from src.pipelines.models import Pipeline, PipelineRun
from src.monitoring.models import AgentMetrics, ActivityLog
from src.monitoring.tasks import celery_health_check
from src.agents.tasks import run_extraction_pipeline_task, run_ocr_task


@pytest.fixture(autouse=True)
def mock_redis():
    """Mock Redis client to avoid network requests and hangs during tests."""
    from unittest.mock import patch
    with patch("src.core.redis_pubsub.sync_redis") as mock_sync_redis:
        yield mock_sync_redis


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


def test_celery_task_routing():
    """Verify tasks are routed to their designated queues."""
    routes = celery_app.conf.task_routes
    assert routes["run_ocr_agent"] == {"queue": "heavy_ops"}
    assert routes["run_web_crawling_task"] == {"queue": "heavy_ops"}
    assert routes["run_extraction_pipeline_task"] == {"queue": "heavy_ops"}
    assert routes["process_notification_task"] == {"queue": "high_priority"}
    assert routes["log_activity_task"] == {"queue": "high_priority"}
    assert routes["celery_health_check"] == {"queue": "high_priority"}


def test_health_check_task():
    """Verify health check task runs successfully in eager mode."""
    result = celery_health_check.apply()
    assert result.status == "SUCCESS"
    assert result.result["status"] == "ok"
    assert "timestamp" in result.result


def test_modular_ocr_task(db):
    """Verify that a modular agent task executes and logs its actions."""
    # Setup test workspace, project, pipeline, and run
    workspace = Workspace(name="Test Workspace")
    db.add(workspace)
    db.flush()

    dataset = Dataset(workspace_id=workspace.id, name="Test Ingest")
    db.add(dataset)
    db.flush()

    pipeline = Pipeline(workspace_id=workspace.id, dataset_id=dataset.id, name="Test Pipeline")
    db.add(pipeline)
    db.flush()

    run = PipelineRun(pipeline_id=pipeline.id, status="queued")
    db.add(run)
    db.commit()

    # Prevent db.close() from closing the test transaction during task run
    original_close = db.close
    db.close = lambda: None

    from unittest.mock import patch
    try:
        with patch("src.agents.tasks.SessionLocal", return_value=db):
            # Execute OCR task synchronously via Celery eager mode
            result = run_ocr_task.apply(args=(str(run.id), str(dataset.id), str(workspace.id), str(pipeline.id)))
    finally:
        db.close = original_close

    assert result.status == "SUCCESS"

    # Verify log entry created in DB
    logs = db.query(ActivityLog).filter(ActivityLog.workspace_id == workspace.id).all()
    assert len(logs) > 0
    assert any("OCR scanning completes" in log.description for log in logs)


def test_pipeline_orchestration_task(db):
    """Verify parent pipeline orchestrator coordinates all steps and saves final results."""
    # Setup test data
    workspace = Workspace(name="Orchestrator Workspace")
    db.add(workspace)
    db.flush()

    dataset = Dataset(workspace_id=workspace.id, name="Ingest Stream")
    db.add(dataset)
    db.flush()

    pipeline = Pipeline(workspace_id=workspace.id, dataset_id=dataset.id, name="ETL Stream")
    db.add(pipeline)
    db.flush()

    run = PipelineRun(pipeline_id=pipeline.id, status="queued")
    db.add(run)
    db.commit()

    # Prevent db.close() from closing the test transaction during task run
    original_close = db.close
    db.close = lambda: None

    from unittest.mock import patch
    try:
        with patch("src.agents.tasks.SessionLocal", return_value=db):
            # Execute orchestrator task in Celery eager mode
            result = run_extraction_pipeline_task.apply(args=(str(run.id), str(dataset.id)))
    finally:
        db.close = original_close

    assert result.status == "SUCCESS"
    assert result.result["status"] == "completed"

    # Verify run and dataset states updated in database
    db.refresh(run)
    db.refresh(dataset)

    assert run.status == "completed"
    assert run.records_processed > 0
    assert run.duration_seconds >= 0
    assert dataset.status == "Ready"
    assert dataset.record_count == run.records_processed

"""Celery integration tests: routing, health, and the real pipeline orchestrator."""

import pytest
from unittest.mock import patch

from src.celery_app import celery_app
from src.core.database import Base, SessionLocal, engine
from src.auth.models import Workspace
from src.datasets.models import DataArtifact, Dataset, DatasetColumn, SourceFile
from src.pipelines.models import Pipeline, PipelineRun
from src.monitoring.tasks import celery_health_check
from src.agents.tasks import run_extraction_pipeline_task

# Import task modules so the routing drift-guard sees every registered task.
import src.copilot.tasks  # noqa: F401


@pytest.fixture(autouse=True)
def mock_redis():
    """Mock Redis so telemetry broadcasts don't require a broker."""
    from unittest.mock import patch as _patch

    with _patch("src.core.redis_pubsub.sync_redis") as mock_sync_redis:
        yield mock_sync_redis


@pytest.fixture(scope="function")
def db():
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


def test_celery_task_routing():
    """Routed keys must match registered task names exactly."""
    routes = celery_app.conf.task_routes
    assert routes["run_extraction_pipeline_task"] == {"queue": "heavy_ops"}
    assert routes["run_copilot_query_task"] == {"queue": "heavy_ops"}
    assert routes["process_notification_task"] == {"queue": "high_priority"}
    assert routes["log_activity_task"] == {"queue": "high_priority"}
    assert routes["celery_health_check"] == {"queue": "high_priority"}

    registered = set(celery_app.tasks.keys())
    for task_name in routes:
        assert task_name in registered, f"Route references unknown task: {task_name}"


def test_health_check_task():
    result = celery_health_check.apply()
    assert result.status == "SUCCESS"
    assert result.result["status"] == "ok"


def test_pipeline_orchestration_csv_end_to_end(db, monkeypatch):
    """The orchestrator ingests a real CSV, extracts, validates, and persists."""
    pytest.importorskip("pandas")
    pytest.importorskip("pyarrow")

    import src.agents.tasks as tasks_mod
    from src.storage import InMemoryObjectStore

    store = InMemoryObjectStore()
    monkeypatch.setattr(tasks_mod, "get_object_store", lambda: store)

    workspace = Workspace(name="Pipeline WS")
    db.add(workspace)
    db.flush()
    dataset = Dataset(
        workspace_id=workspace.id, name="CSV DS", source_type="csv", status="Empty"
    )
    db.add(dataset)
    db.flush()
    pipeline = Pipeline(
        workspace_id=workspace.id,
        dataset_id=dataset.id,
        name="CSV Pipeline",
        run_configuration={},
    )
    db.add(pipeline)
    db.flush()
    run = PipelineRun(pipeline_id=pipeline.id, status="queued")
    db.add(run)
    db.commit()

    key = f"workspaces/{workspace.id}/datasets/{dataset.id}/sources/data.csv"
    payload = b"name,age\nAda,36\nBob,40\nCy,29\n"
    store.put_object(key, payload, "text/csv")
    db.add(
        SourceFile(
            workspace_id=workspace.id,
            dataset_id=dataset.id,
            original_filename="data.csv",
            content_type="text/csv",
            size_bytes=len(payload),
            storage_key=key,
            status="stored",
        )
    )
    db.commit()

    original_close = db.close
    db.close = lambda: None
    try:
        with patch("src.agents.tasks.SessionLocal", return_value=db):
            result = run_extraction_pipeline_task.apply(
                args=(str(run.id), str(dataset.id))
            )
    finally:
        db.close = original_close

    assert result.status == "SUCCESS"
    assert result.result["status"] == "completed"

    db.refresh(run)
    db.refresh(dataset)
    assert run.status == "completed"
    assert run.records_processed == 3
    assert dataset.status == "Ready"
    assert dataset.record_count == 3
    assert dataset.column_count == 2
    assert dataset.s3_path  # artifact key recorded
    assert 0 < float(dataset.quality_score) <= 100

    assert db.query(DataArtifact).filter_by(dataset_id=dataset.id).count() == 1
    assert db.query(DatasetColumn).filter_by(dataset_id=dataset.id).count() == 2
    # The artifact bytes were written to object storage.
    artifact = db.query(DataArtifact).filter_by(dataset_id=dataset.id).first()
    assert store.exists(artifact.storage_key)


def test_pipeline_fails_cleanly_without_source(db, monkeypatch):
    """A file dataset with no uploaded source fails the run with a clear status."""
    import src.agents.tasks as tasks_mod
    from src.storage import InMemoryObjectStore

    monkeypatch.setattr(tasks_mod, "get_object_store", lambda: InMemoryObjectStore())

    workspace = Workspace(name="No Source WS")
    db.add(workspace)
    db.flush()
    dataset = Dataset(
        workspace_id=workspace.id, name="Empty DS", source_type="csv", status="Empty"
    )
    db.add(dataset)
    db.flush()
    pipeline = Pipeline(
        workspace_id=workspace.id, dataset_id=dataset.id, name="P", run_configuration={}
    )
    db.add(pipeline)
    db.flush()
    run = PipelineRun(pipeline_id=pipeline.id, status="queued")
    db.add(run)
    db.commit()

    original_close = db.close
    db.close = lambda: None
    try:
        with patch("src.agents.tasks.SessionLocal", return_value=db):
            result = run_extraction_pipeline_task.apply(
                args=(str(run.id), str(dataset.id))
            )
    finally:
        db.close = original_close

    assert result.result["status"] == "failed"
    db.refresh(run)
    db.refresh(dataset)
    assert run.status == "failed"
    assert dataset.status == "Failed"
    assert run.error_message

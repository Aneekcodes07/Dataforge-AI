"""Copilot tests.

Routing and prompt assembly are pure and run offline. The DB-backed tools and the
end-to-end service are exercised with sqlite + the MockProvider where SQLAlchemy
is available (CI).
"""

import uuid

import pytest

from src.copilot.service import build_messages, route_intent


def test_route_intent():
    assert route_intent("which pipelines failed yesterday?") == "failed_runs"
    assert route_intent("show me low-quality datasets") == "dataset_quality"
    assert route_intent("suggest cleaning rules") == "cleaning"
    assert route_intent("is any agent overloaded?") == "agent_status"
    assert route_intent("how can I optimize cost?") == "optimizations"
    assert route_intent("hello there") == "general"


def test_build_messages_includes_context_and_question():
    messages = build_messages("What failed?", "TOOLCTX", "RAGCTX")
    assert len(messages) == 2
    assert messages[0].role == "system"
    user = messages[1].content
    assert "TOOLCTX" in user
    assert "RAGCTX" in user
    assert "What failed?" in user


def test_build_messages_without_context():
    messages = build_messages("hi", "", "")
    assert "Question: hi" in messages[1].content


def test_tools_and_service_end_to_end():
    pytest.importorskip("sqlalchemy")
    from src.ai.llm import LLMGateway, MockProvider, ModelRegistry
    from src.ai.rag import InMemoryVectorStore
    from src.auth.models import Workspace
    from src.copilot import tools
    from src.copilot.service import CopilotService
    from src.core.database import Base, SessionLocal, engine
    from src.datasets.models import Dataset
    from src.pipelines.models import Pipeline, PipelineRun

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        ws = Workspace(name="Copilot WS")
        db.add(ws)
        db.flush()
        dataset = Dataset(
            workspace_id=ws.id,
            name="DS",
            status="Ready",
            quality_score=80,
            record_count=10,
            column_count=3,
        )
        db.add(dataset)
        pipeline = Pipeline(workspace_id=ws.id, dataset_id=dataset.id, name="P")
        db.add(pipeline)
        db.flush()
        db.add(
            PipelineRun(pipeline_id=pipeline.id, status="failed", error_message="boom")
        )
        db.commit()

        result = tools.get_failed_runs(db, str(ws.id))
        assert result.card_type == "pipeline"
        assert result.card_data["failedCount"] == 1
        assert "boom" in result.context

        gateway = LLMGateway(
            ModelRegistry.all_mock(), {"mock": MockProvider(embed_dim=64)}
        )
        service = CopilotService(db, gateway, InMemoryVectorStore())
        text, card_type, card_data = service.complete(
            str(ws.id), "which pipelines failed?", str(uuid.uuid4())
        )
        assert text  # real LLM (mock) or factual fallback
        assert card_type == "pipeline"
        assert card_data["failedCount"] == 1
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

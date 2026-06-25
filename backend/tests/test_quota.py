"""Cost quota tests — pure guard offline; DB aggregation in CI."""

import uuid

import pytest

from src.ai.quota import check_quota, is_within_quota


def test_is_within_quota_unlimited():
    assert is_within_quota(1_000_000, 0) is True
    assert is_within_quota(1_000_000, -5) is True


def test_is_within_quota_bounds():
    assert is_within_quota(4.99, 5.0) is True
    assert is_within_quota(5.0, 5.0) is False
    assert is_within_quota(7.0, 5.0) is False


def test_check_quota_no_workspace_is_allowed():
    assert check_quota(None, None, 5.0) is True


def test_monthly_cost_and_check_quota_with_db():
    pytest.importorskip("sqlalchemy")
    from src.ai.models import LLMUsageEvent
    from src.ai.quota import monthly_cost_usd
    from src.auth.models import Workspace
    from src.core.database import Base, SessionLocal, engine

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        ws = Workspace(name="Quota WS")
        db.add(ws)
        db.flush()
        for cost in (1.5, 2.25):
            db.add(
                LLMUsageEvent(
                    workspace_id=ws.id,
                    feature="copilot",
                    provider="openai",
                    model="gpt-4o",
                    prompt_tokens=10,
                    completion_tokens=10,
                    total_tokens=20,
                    cost_usd=cost,
                    latency_ms=100,
                    status="ok",
                )
            )
        db.commit()

        total = monthly_cost_usd(db, str(ws.id))
        assert abs(total - 3.75) < 1e-6
        assert check_quota(db, str(ws.id), cap_usd=5.0) is True
        assert check_quota(db, str(ws.id), cap_usd=3.0) is False
        # Unknown workspace has no spend.
        assert monthly_cost_usd(db, str(uuid.uuid4())) == 0.0
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

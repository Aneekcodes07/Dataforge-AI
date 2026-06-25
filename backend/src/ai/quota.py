"""Per-workspace LLM cost quota.

``is_within_quota`` is a pure function (unit-tested offline). ``monthly_cost_usd``
sums the current calendar month's spend from ``llm_usage_events``. A cap of 0
(default) means unlimited. Enforcement is a soft gate at AI call sites: the
Copilot degrades to factual answers and document extraction fails cleanly with a
clear message rather than silently overspending.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


class QuotaExceededError(Exception):
    """Raised when a workspace has exhausted its monthly AI budget."""


def is_within_quota(used_usd: float, cap_usd: float) -> bool:
    """Return True if spend is allowed. A cap <= 0 means unlimited."""
    if cap_usd <= 0:
        return True
    return used_usd < cap_usd


def _month_start() -> datetime:
    now = datetime.now(timezone.utc)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def monthly_cost_usd(db: Any, workspace_id: str) -> float:
    """Sum this calendar month's LLM spend (USD) for a workspace."""
    import uuid

    from sqlalchemy import func

    from src.ai.models import LLMUsageEvent

    total = (
        db.query(func.coalesce(func.sum(LLMUsageEvent.cost_usd), 0))
        .filter(
            LLMUsageEvent.workspace_id == uuid.UUID(workspace_id),
            LLMUsageEvent.created_at >= _month_start(),
        )
        .scalar()
    )
    return float(total or 0)


def check_quota(db: Any, workspace_id: str | None, cap_usd: float) -> bool:
    """Return True if the workspace may make another paid AI call."""
    if cap_usd <= 0 or not workspace_id:
        return True
    return is_within_quota(monthly_cost_usd(db, workspace_id), cap_usd)

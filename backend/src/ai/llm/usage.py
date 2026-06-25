"""Usage recorder — persists LLM usage events and exports Prometheus metrics.

Imported lazily by the gateway factory (not at package import) so the gateway and
mock provider stay importable without prometheus or a database.
"""

from __future__ import annotations

import logging
import uuid
from typing import Callable

from prometheus_client import Counter, Histogram

from src.ai.llm.base import UsageEvent

logger = logging.getLogger(__name__)

LLM_REQUESTS_TOTAL = Counter(
    "llm_requests_total",
    "Total LLM requests by provider/model/feature/status",
    ["provider", "model", "feature", "status"],
)
LLM_TOKENS_TOTAL = Counter(
    "llm_tokens_total",
    "Total LLM tokens by provider/model/feature/kind",
    ["provider", "model", "feature", "kind"],
)
LLM_COST_USD_TOTAL = Counter(
    "llm_cost_usd_total",
    "Total LLM spend in USD by provider/model/feature",
    ["provider", "model", "feature"],
)
LLM_REQUEST_DURATION_SECONDS = Histogram(
    "llm_request_duration_seconds",
    "LLM request latency in seconds",
    ["provider", "model"],
    buckets=(0.1, 0.25, 0.5, 1.0, 2.0, 5.0, 10.0, 20.0, 30.0, 60.0, float("inf")),
)


class PrometheusDBUsageRecorder:
    """Records usage to Prometheus and the ``llm_usage_events`` table."""

    def __init__(self, session_factory: Callable) -> None:
        self._session_factory = session_factory

    def record(self, event: UsageEvent) -> None:
        self._emit_metrics(event)
        self._persist(event)

    def _emit_metrics(self, event: UsageEvent) -> None:
        try:
            LLM_REQUESTS_TOTAL.labels(
                event.provider, event.model, event.feature, event.status
            ).inc()
            LLM_REQUEST_DURATION_SECONDS.labels(event.provider, event.model).observe(
                event.latency_ms / 1000.0
            )
            if event.prompt_tokens:
                LLM_TOKENS_TOTAL.labels(
                    event.provider, event.model, event.feature, "prompt"
                ).inc(event.prompt_tokens)
            if event.completion_tokens:
                LLM_TOKENS_TOTAL.labels(
                    event.provider, event.model, event.feature, "completion"
                ).inc(event.completion_tokens)
            if event.cost_usd:
                LLM_COST_USD_TOTAL.labels(
                    event.provider, event.model, event.feature
                ).inc(event.cost_usd)
        except Exception:  # noqa: BLE001 - metrics must never break a request
            logger.exception("Failed to emit LLM usage metrics")

    def _persist(self, event: UsageEvent) -> None:
        from src.ai.models import LLMUsageEvent

        db = self._session_factory()
        try:
            row = LLMUsageEvent(
                workspace_id=_as_uuid(event.workspace_id),
                user_id=_as_uuid(event.user_id),
                feature=event.feature,
                provider=event.provider,
                model=event.model,
                prompt_tokens=event.prompt_tokens,
                completion_tokens=event.completion_tokens,
                total_tokens=event.total_tokens,
                cost_usd=event.cost_usd,
                latency_ms=event.latency_ms,
                status=event.status,
                run_id=_as_uuid(event.run_id),
            )
            db.add(row)
            db.commit()
        except Exception:  # noqa: BLE001 - usage logging is best-effort
            logger.exception("Failed to persist LLM usage event")
            db.rollback()
        finally:
            db.close()


def _as_uuid(value: str | None) -> uuid.UUID | None:
    if not value:
        return None
    try:
        return uuid.UUID(str(value))
    except (ValueError, AttributeError, TypeError):
        return None

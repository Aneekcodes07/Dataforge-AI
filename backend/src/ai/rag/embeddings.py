"""Embedding service — turns text into vectors via the LLM gateway."""

from __future__ import annotations

from typing import Any, Sequence

from src.ai.llm import ROLE_EMBED


class EmbeddingService:
    def __init__(self, gateway: Any) -> None:
        self._gateway = gateway

    def embed(
        self,
        texts: Sequence[str],
        *,
        workspace_id: str | None = None,
        run_id: str | None = None,
    ) -> list[list[float]]:
        if not texts:
            return []
        response = self._gateway.embed(
            list(texts),
            role=ROLE_EMBED,
            feature="embedding",
            workspace_id=workspace_id,
            run_id=run_id,
        )
        return response.embeddings

"""Semantic retrieval — embed a query and search the vector store."""

from __future__ import annotations

from typing import Any

from src.ai.rag.embeddings import EmbeddingService
from src.ai.rag.vector_store import SearchResult, VectorStore


def semantic_search(
    *,
    vector_store: VectorStore,
    gateway: Any,
    workspace_id: str,
    query: str,
    top_k: int = 5,
    dataset_id: str | None = None,
) -> list[SearchResult]:
    embeddings = EmbeddingService(gateway).embed([query], workspace_id=workspace_id)
    if not embeddings:
        return []
    return vector_store.search(
        workspace_id, embeddings[0], top_k=top_k, dataset_id=dataset_id
    )

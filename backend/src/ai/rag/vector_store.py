"""Vector store abstraction.

InMemoryVectorStore (cosine, dependency-free) backs unit tests; PgVectorStore
persists to the ``document_chunks`` table using pgvector for production. All
queries are scoped by workspace for tenant isolation.
"""

from __future__ import annotations

import abc
import math
from dataclasses import dataclass, field
from typing import Callable


@dataclass
class ChunkInput:
    workspace_id: str
    dataset_id: str | None
    source_file_id: str | None
    chunk_index: int
    content: str
    embedding: list[float]
    metadata: dict = field(default_factory=dict)


@dataclass
class SearchResult:
    content: str
    score: float
    dataset_id: str | None
    chunk_index: int
    metadata: dict


class VectorStore(abc.ABC):
    @abc.abstractmethod
    def add_chunks(self, chunks: list[ChunkInput]) -> int: ...

    @abc.abstractmethod
    def search(
        self,
        workspace_id: str,
        embedding: list[float],
        *,
        top_k: int = 5,
        dataset_id: str | None = None,
    ) -> list[SearchResult]: ...

    @abc.abstractmethod
    def delete_by_dataset(self, dataset_id: str) -> None: ...


def cosine_similarity(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


class InMemoryVectorStore(VectorStore):
    """Process-local cosine vector store for tests/dev."""

    def __init__(self) -> None:
        self._chunks: list[ChunkInput] = []

    def add_chunks(self, chunks: list[ChunkInput]) -> int:
        self._chunks.extend(chunks)
        return len(chunks)

    def search(
        self,
        workspace_id: str,
        embedding: list[float],
        *,
        top_k: int = 5,
        dataset_id: str | None = None,
    ) -> list[SearchResult]:
        scored: list[SearchResult] = []
        for chunk in self._chunks:
            if chunk.workspace_id != workspace_id:
                continue
            if dataset_id is not None and chunk.dataset_id != dataset_id:
                continue
            scored.append(
                SearchResult(
                    content=chunk.content,
                    score=cosine_similarity(embedding, chunk.embedding),
                    dataset_id=chunk.dataset_id,
                    chunk_index=chunk.chunk_index,
                    metadata=chunk.metadata,
                )
            )
        scored.sort(key=lambda r: r.score, reverse=True)
        return scored[:top_k]

    def delete_by_dataset(self, dataset_id: str) -> None:
        self._chunks = [c for c in self._chunks if c.dataset_id != dataset_id]


class PgVectorStore(VectorStore):
    """pgvector-backed store persisting to the document_chunks table."""

    def __init__(self, session_factory: Callable) -> None:
        self._session_factory = session_factory

    def add_chunks(self, chunks: list[ChunkInput]) -> int:
        import uuid

        from src.ai.models import DocumentChunk

        db = self._session_factory()
        try:
            for chunk in chunks:
                db.add(
                    DocumentChunk(
                        workspace_id=uuid.UUID(chunk.workspace_id),
                        dataset_id=uuid.UUID(chunk.dataset_id)
                        if chunk.dataset_id
                        else None,
                        source_file_id=uuid.UUID(chunk.source_file_id)
                        if chunk.source_file_id
                        else None,
                        chunk_index=chunk.chunk_index,
                        content=chunk.content,
                        embedding=chunk.embedding,
                        extra_metadata=chunk.metadata,
                        token_count=len(chunk.content) // 4,
                    )
                )
            db.commit()
            return len(chunks)
        finally:
            db.close()

    def search(
        self,
        workspace_id: str,
        embedding: list[float],
        *,
        top_k: int = 5,
        dataset_id: str | None = None,
    ) -> list[SearchResult]:
        import uuid

        from src.ai.models import DocumentChunk

        db = self._session_factory()
        try:
            distance = DocumentChunk.embedding.cosine_distance(embedding)
            query = db.query(DocumentChunk, distance.label("distance")).filter(
                DocumentChunk.workspace_id == uuid.UUID(workspace_id)
            )
            if dataset_id is not None:
                query = query.filter(DocumentChunk.dataset_id == uuid.UUID(dataset_id))
            rows = query.order_by(distance.asc()).limit(top_k).all()
            return [
                SearchResult(
                    content=chunk.content,
                    score=1.0 - float(dist),
                    dataset_id=str(chunk.dataset_id) if chunk.dataset_id else None,
                    chunk_index=chunk.chunk_index,
                    metadata=chunk.extra_metadata or {},
                )
                for chunk, dist in rows
            ]
        finally:
            db.close()

    def delete_by_dataset(self, dataset_id: str) -> None:
        import uuid

        from src.ai.models import DocumentChunk

        db = self._session_factory()
        try:
            db.query(DocumentChunk).filter(
                DocumentChunk.dataset_id == uuid.UUID(dataset_id)
            ).delete()
            db.commit()
        finally:
            db.close()

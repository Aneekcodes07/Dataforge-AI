"""RAG package — chunking, embeddings, vector store, indexing, and retrieval."""

from __future__ import annotations

from functools import lru_cache

from src.ai.rag.chunking import chunk_text, records_to_text
from src.ai.rag.embeddings import EmbeddingService
from src.ai.rag.indexer import index_parsed_document, index_text
from src.ai.rag.retriever import semantic_search
from src.ai.rag.vector_store import (
    ChunkInput,
    InMemoryVectorStore,
    PgVectorStore,
    SearchResult,
    VectorStore,
)

__all__ = [
    "chunk_text",
    "records_to_text",
    "EmbeddingService",
    "index_text",
    "index_parsed_document",
    "semantic_search",
    "VectorStore",
    "InMemoryVectorStore",
    "PgVectorStore",
    "ChunkInput",
    "SearchResult",
    "get_vector_store",
]


@lru_cache
def get_vector_store() -> VectorStore:
    """Return the configured (cached) production vector store."""
    from src.core.database import SessionLocal

    return PgVectorStore(SessionLocal)

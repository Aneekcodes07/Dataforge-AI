"""Indexing — chunk content, embed it, and store it in a vector store."""

from __future__ import annotations

from typing import Any

from src.ai.rag.chunking import chunk_text, records_to_text
from src.ai.rag.embeddings import EmbeddingService
from src.ai.rag.vector_store import ChunkInput, VectorStore


def index_text(
    *,
    vector_store: VectorStore,
    gateway: Any,
    workspace_id: str,
    dataset_id: str | None,
    text: str,
    source_file_id: str | None = None,
    metadata: dict | None = None,
    max_chars: int = 1200,
    overlap: int = 150,
    replace: bool = True,
) -> int:
    """Chunk, embed, and store text. Returns the number of chunks stored."""
    chunks = chunk_text(text, max_chars=max_chars, overlap=overlap)
    if not chunks:
        return 0

    embeddings = EmbeddingService(gateway).embed(chunks, workspace_id=workspace_id)
    if len(embeddings) != len(chunks):
        return 0

    if replace and dataset_id:
        vector_store.delete_by_dataset(dataset_id)

    inputs = [
        ChunkInput(
            workspace_id=workspace_id,
            dataset_id=dataset_id,
            source_file_id=source_file_id,
            chunk_index=index,
            content=content,
            embedding=embedding,
            metadata=metadata or {},
        )
        for index, (content, embedding) in enumerate(zip(chunks, embeddings))
    ]
    return vector_store.add_chunks(inputs)


def index_parsed_document(
    *,
    vector_store: VectorStore,
    gateway: Any,
    workspace_id: str,
    dataset_id: str,
    parsed,
    source_file_id: str | None = None,
    max_chars: int = 1200,
    overlap: int = 150,
) -> int:
    """Index a ParsedDocument (free text and/or its primary table)."""
    parts: list[str] = []
    if parsed.text and parsed.text.strip():
        parts.append(parsed.text)
    table = parsed.primary_table
    if table is not None and table.row_count > 0:
        parts.append(records_to_text(table.columns, table.rows))

    blob = "\n\n".join(parts).strip()
    if not blob:
        return 0

    return index_text(
        vector_store=vector_store,
        gateway=gateway,
        workspace_id=workspace_id,
        dataset_id=dataset_id,
        text=blob,
        source_file_id=source_file_id,
        metadata={"datasetId": dataset_id},
        max_chars=max_chars,
        overlap=overlap,
    )

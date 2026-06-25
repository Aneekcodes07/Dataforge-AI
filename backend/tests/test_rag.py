"""RAG tests — chunking, in-memory vector store, indexing, and retrieval.

All offline: uses the InMemoryVectorStore and the deterministic MockProvider for
embeddings (no pgvector, network, or real provider).
"""

from src.ai.llm import LLMGateway, MockProvider, ModelRegistry
from src.ai.rag import (
    ChunkInput,
    InMemoryVectorStore,
    chunk_text,
    index_parsed_document,
    index_text,
    records_to_text,
    semantic_search,
)
from src.ai.rag.vector_store import cosine_similarity
from src.processing.base import ParsedDocument, ParsedTable


def _gateway(dim: int = 64) -> LLMGateway:
    return LLMGateway(ModelRegistry.all_mock(), {"mock": MockProvider(embed_dim=dim)})


def test_chunk_text_short_returns_single():
    assert chunk_text("hello world") == ["hello world"]
    assert chunk_text("   ") == []


def test_chunk_text_splits_with_overlap_and_terminates():
    text = " ".join(f"word{i}" for i in range(800))
    chunks = chunk_text(text, max_chars=200, overlap=40)
    assert len(chunks) > 1
    assert all(len(c) <= 200 for c in chunks)
    assert all(c.strip() for c in chunks)


def test_records_to_text():
    text = records_to_text(["name", "age"], [["Ada", 36], ["Bob", None]])
    assert "name: Ada; age: 36" in text
    assert "Bob" in text and "age: None" not in text  # nulls skipped


def test_cosine_similarity():
    assert cosine_similarity([1, 0], [1, 0]) == 1.0
    assert abs(cosine_similarity([1, 0], [0, 1])) < 1e-9
    assert cosine_similarity([], [1]) == 0.0


def test_in_memory_vector_store_search_and_scoping():
    store = InMemoryVectorStore()
    store.add_chunks(
        [
            ChunkInput("w1", "d1", None, 0, "a", [1.0, 0.0]),
            ChunkInput("w1", "d1", None, 1, "b", [0.0, 1.0]),
            ChunkInput("w2", "d2", None, 0, "c", [1.0, 0.0]),
        ]
    )
    results = store.search("w1", [1.0, 0.0], top_k=5)
    assert [r.content for r in results][0] == "a"
    assert all(r.dataset_id == "d1" for r in results)  # workspace-scoped

    only_other = store.search("w2", [1.0, 0.0], top_k=5)
    assert len(only_other) == 1 and only_other[0].content == "c"

    store.delete_by_dataset("d1")
    assert store.search("w1", [1.0, 0.0], top_k=5) == []


def test_index_and_retrieve_roundtrip():
    gateway = _gateway()
    store = InMemoryVectorStore()
    stored = index_text(
        vector_store=store,
        gateway=gateway,
        workspace_id="w1",
        dataset_id="d1",
        text="alpha beta gamma delta",
    )
    assert stored >= 1

    results = semantic_search(
        vector_store=store,
        gateway=gateway,
        workspace_id="w1",
        query="alpha beta gamma delta",
        top_k=3,
    )
    assert results
    # Identical text embeds identically -> near-perfect cosine score.
    assert results[0].score > 0.99

    # Wrong workspace returns nothing.
    assert (
        semantic_search(
            vector_store=store, gateway=gateway, workspace_id="other", query="alpha"
        )
        == []
    )


def test_index_parsed_document_table():
    gateway = _gateway()
    store = InMemoryVectorStore()
    doc = ParsedDocument(
        source_type="csv",
        tables=[ParsedTable(columns=["name", "city"], rows=[["Ada", "London"]])],
    )
    stored = index_parsed_document(
        vector_store=store,
        gateway=gateway,
        workspace_id="w1",
        dataset_id="d1",
        parsed=doc,
    )
    assert stored >= 1
    results = store.search("w1", gateway.embed(["Ada"]).embeddings[0], top_k=1)
    assert results

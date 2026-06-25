"""Tests for the object storage abstraction.

These exercise the backend-agnostic contract via the in-memory backend, so they
run without a network or a MinIO/S3 instance. The S3 backend is exercised
separately by integration tests against MinIO.
"""

import io

import pytest

from src.storage import InMemoryObjectStore
from src.storage.base import ObjectNotFoundError, StoredObject


@pytest.fixture
def store() -> InMemoryObjectStore:
    return InMemoryObjectStore()


def test_put_and_get_roundtrip(store: InMemoryObjectStore):
    meta = store.put_object("a/b.txt", b"hello world", content_type="text/plain")
    assert isinstance(meta, StoredObject)
    assert meta.key == "a/b.txt"
    assert meta.size == 11
    assert meta.content_type == "text/plain"
    assert store.get_object("a/b.txt") == b"hello world"
    assert store.exists("a/b.txt") is True


def test_put_stream_roundtrip(store: InMemoryObjectStore):
    stream = io.BytesIO(b"streamed-bytes")
    meta = store.put_stream(
        "s/file.bin", stream, content_type="application/octet-stream"
    )
    assert meta.size == len(b"streamed-bytes")
    assert store.get_object("s/file.bin") == b"streamed-bytes"


def test_open_stream_chunks(store: InMemoryObjectStore):
    payload = b"0123456789"
    store.put_object("chunked", payload)
    chunks = list(store.open_stream("chunked", chunk_size=3))
    assert chunks == [b"012", b"345", b"678", b"9"]
    assert b"".join(chunks) == payload


def test_get_missing_raises(store: InMemoryObjectStore):
    with pytest.raises(ObjectNotFoundError):
        store.get_object("does-not-exist")


def test_delete_is_idempotent(store: InMemoryObjectStore):
    store.put_object("temp", b"x")
    assert store.exists("temp") is True
    store.delete("temp")
    assert store.exists("temp") is False
    # Deleting again must not raise.
    store.delete("temp")


def test_presigned_url_requires_existing_object(store: InMemoryObjectStore):
    store.put_object("k", b"data")
    url = store.presigned_get_url("k", expires_in=120)
    assert url.startswith("memory://k")
    assert "expires_in=120" in url
    with pytest.raises(ObjectNotFoundError):
        store.presigned_get_url("missing")

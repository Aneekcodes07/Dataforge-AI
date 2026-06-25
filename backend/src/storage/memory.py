"""In-memory object store.

A fully-functional :class:`ObjectStore` backed by a process-local dict. This is a
test double used by the unit suite so storage-dependent code can be exercised
without a network or a running MinIO/S3 instance. It is never selected by the
production factory.
"""

from __future__ import annotations

from typing import BinaryIO, Iterator

from src.storage.base import (
    ObjectNotFoundError,
    ObjectStore,
    StoredObject,
)


class InMemoryObjectStore(ObjectStore):
    """Object store that keeps all objects in memory. For tests only."""

    def __init__(self) -> None:
        self._objects: dict[str, bytes] = {}
        self._content_types: dict[str, str | None] = {}

    def put_object(
        self, key: str, data: bytes, content_type: str | None = None
    ) -> StoredObject:
        self._objects[key] = bytes(data)
        self._content_types[key] = content_type
        return StoredObject(key=key, size=len(data), content_type=content_type)

    def put_stream(
        self, key: str, stream: BinaryIO, content_type: str | None = None
    ) -> StoredObject:
        return self.put_object(key, stream.read(), content_type=content_type)

    def get_object(self, key: str) -> bytes:
        try:
            return self._objects[key]
        except KeyError as exc:
            raise ObjectNotFoundError(key) from exc

    def open_stream(self, key: str, chunk_size: int = 1024 * 1024) -> Iterator[bytes]:
        data = self.get_object(key)
        for offset in range(0, len(data), chunk_size):
            yield data[offset : offset + chunk_size]

    def delete(self, key: str) -> None:
        self._objects.pop(key, None)
        self._content_types.pop(key, None)

    def exists(self, key: str) -> bool:
        return key in self._objects

    def presigned_get_url(self, key: str, expires_in: int = 3600) -> str:
        if not self.exists(key):
            raise ObjectNotFoundError(key)
        return f"memory://{key}?expires_in={expires_in}"

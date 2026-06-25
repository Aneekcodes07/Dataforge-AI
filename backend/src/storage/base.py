"""Object storage abstraction.

Defines the backend-agnostic contract used across the platform for storing raw
uploads, intermediate artifacts, and extracted datasets. Concrete backends
(S3/MinIO for production, an in-memory double for tests) implement this contract
so the rest of the codebase never depends on a specific storage vendor.
"""

from __future__ import annotations

import abc
from dataclasses import dataclass
from typing import BinaryIO, Iterator


class StorageError(Exception):
    """Base class for all object-storage failures."""


class ObjectNotFoundError(StorageError):
    """Raised when a requested object key does not exist."""


@dataclass(frozen=True)
class StoredObject:
    """Metadata describing a stored object."""

    key: str
    size: int
    content_type: str | None = None


class ObjectStore(abc.ABC):
    """Backend-agnostic object storage interface."""

    @abc.abstractmethod
    def put_object(
        self, key: str, data: bytes, content_type: str | None = None
    ) -> StoredObject:
        """Store ``data`` at ``key`` and return its metadata."""

    @abc.abstractmethod
    def put_stream(
        self, key: str, stream: BinaryIO, content_type: str | None = None
    ) -> StoredObject:
        """Store the contents of ``stream`` at ``key`` (streamed, not buffered)."""

    @abc.abstractmethod
    def get_object(self, key: str) -> bytes:
        """Return the full object bytes. Raises :class:`ObjectNotFoundError`."""

    @abc.abstractmethod
    def open_stream(self, key: str, chunk_size: int = 1024 * 1024) -> Iterator[bytes]:
        """Yield the object in chunks. Raises :class:`ObjectNotFoundError`."""

    @abc.abstractmethod
    def delete(self, key: str) -> None:
        """Delete ``key``. Idempotent: deleting a missing key is not an error."""

    @abc.abstractmethod
    def exists(self, key: str) -> bool:
        """Return whether ``key`` exists."""

    @abc.abstractmethod
    def presigned_get_url(self, key: str, expires_in: int = 3600) -> str:
        """Return a time-limited URL for downloading ``key`` directly."""

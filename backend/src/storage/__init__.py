"""Object storage package.

Use :func:`get_object_store` to obtain the configured production backend
(S3-compatible). The concrete backends and the abstract contract are exported for
typing and tests.
"""

from __future__ import annotations

from functools import lru_cache

from src.storage.base import (
    ObjectNotFoundError,
    ObjectStore,
    StorageError,
    StoredObject,
)
from src.storage.memory import InMemoryObjectStore
from src.storage.s3 import S3ObjectStore

__all__ = [
    "ObjectStore",
    "StoredObject",
    "StorageError",
    "ObjectNotFoundError",
    "S3ObjectStore",
    "InMemoryObjectStore",
    "get_object_store",
]


@lru_cache
def get_object_store() -> ObjectStore:
    """Return the configured (cached) production object store."""
    from src.core.config import get_settings

    return S3ObjectStore(get_settings())

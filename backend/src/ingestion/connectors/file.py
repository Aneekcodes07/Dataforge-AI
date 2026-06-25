"""File connector — loads a previously-uploaded object from object storage."""

from __future__ import annotations

from src.ingestion.connectors.base import BaseConnector, RawDocument
from src.storage.base import ObjectStore


class FileConnector(BaseConnector):
    """Reads a stored upload (by storage key) into a :class:`RawDocument`."""

    def __init__(
        self,
        store: ObjectStore,
        storage_key: str,
        *,
        filename: str | None = None,
        content_type: str | None = None,
    ) -> None:
        self._store = store
        self._storage_key = storage_key
        self._filename = filename
        self._content_type = content_type

    def fetch(self) -> list[RawDocument]:
        content = self._store.get_object(self._storage_key)
        return [
            RawDocument(
                content=content,
                content_type=self._content_type,
                filename=self._filename,
                source_uri=self._storage_key,
                metadata={"storage_key": self._storage_key},
            )
        ]

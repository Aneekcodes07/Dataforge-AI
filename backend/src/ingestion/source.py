"""Build the right connector for a dataset's configured source.

Shared by the pipeline orchestrator and the synchronous preview endpoint so the
source-resolution logic lives in exactly one place.
"""

from __future__ import annotations

from typing import Any, Protocol

from src.ingestion.connectors import ApiConnector, FileConnector, UrlConnector
from src.ingestion.connectors.base import BaseConnector
from src.ingestion.validation import FILE_SOURCE_TYPES


class SourceConfigError(ValueError):
    """Raised when a dataset's source configuration is missing or invalid."""


class _SourceFileLike(Protocol):
    storage_key: str
    original_filename: str | None
    content_type: str | None


def build_connector(
    source_type: str,
    config: dict,
    *,
    store: Any | None = None,
    source_file: _SourceFileLike | None = None,
) -> BaseConnector:
    stype = (source_type or "").lower()
    config = config or {}
    source = config.get("source") if isinstance(config.get("source"), dict) else {}

    if stype in FILE_SOURCE_TYPES:
        if source_file is None or store is None:
            raise SourceConfigError("No source file has been uploaded for this dataset")
        return FileConnector(
            store,
            source_file.storage_key,
            filename=source_file.original_filename,
            content_type=source_file.content_type,
        )

    if stype == "url":
        url = config.get("url") or source.get("url")
        if not url:
            raise SourceConfigError("No URL configured for this dataset")
        return UrlConnector(url)

    if stype == "api":
        endpoint = config.get("endpoint") or config.get("url") or source.get("endpoint")
        if not endpoint:
            raise SourceConfigError("No API endpoint configured for this dataset")
        return ApiConnector(
            endpoint,
            method=config.get("method", "GET"),
            headers=config.get("headers") or {},
            params=config.get("params") or {},
        )

    raise SourceConfigError(f"Unsupported source type '{source_type}'")

"""Connector contract and the raw-document intermediate representation."""

from __future__ import annotations

import abc
from dataclasses import dataclass, field


class IngestionError(Exception):
    """Base class for ingestion/connector failures."""


class PayloadTooLargeError(IngestionError):
    """Raised when a fetched payload exceeds the configured byte limit."""


@dataclass
class RawDocument:
    """A single acquired payload prior to parsing.

    ``content`` holds the raw bytes; downstream processing decides how to parse it
    based on ``content_type``/``filename``.
    """

    content: bytes
    content_type: str | None = None
    filename: str | None = None
    source_uri: str | None = None
    metadata: dict = field(default_factory=dict)

    @property
    def size(self) -> int:
        return len(self.content)


class BaseConnector(abc.ABC):
    """Acquires one or more :class:`RawDocument` payloads from a source."""

    @abc.abstractmethod
    def fetch(self) -> list[RawDocument]:
        """Acquire payloads. Implementations must enforce size/time limits."""

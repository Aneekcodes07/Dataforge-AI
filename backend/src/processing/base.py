"""Normalized document intermediate representation (IR).

Every source type (PDF, image, CSV, Excel, JSON, HTML) is parsed into a single
:class:`ParsedDocument` so downstream extraction/validation can treat all inputs
uniformly: structured inputs populate ``tables``; documents populate ``text``
(and any detected ``tables``).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


class ProcessingError(Exception):
    """Raised when a document cannot be parsed."""


@dataclass
class ParsedTable:
    """A rectangular table extracted from a source."""

    columns: list[str]
    rows: list[list[Any]]
    name: str | None = None

    @property
    def row_count(self) -> int:
        return len(self.rows)

    @property
    def column_count(self) -> int:
        return len(self.columns)


@dataclass
class ParsedDocument:
    """The normalized result of parsing a single raw payload."""

    source_type: str
    text: str = ""
    tables: list[ParsedTable] = field(default_factory=list)
    metadata: dict = field(default_factory=dict)
    page_count: int = 0

    @property
    def has_tables(self) -> bool:
        return any(t.row_count > 0 for t in self.tables)

    @property
    def primary_table(self) -> ParsedTable | None:
        """The largest table by row count, if any."""
        tables = [t for t in self.tables if t.column_count > 0]
        if not tables:
            return None
        return max(tables, key=lambda t: t.row_count)

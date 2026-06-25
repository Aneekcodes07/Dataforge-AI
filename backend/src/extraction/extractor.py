"""Structured extraction.

Tabular documents map rows directly onto the schema (deterministic, no LLM).
Text/document sources use the LLM (via the gateway) with JSON-constrained output,
then every record is coerced to the schema's types.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from src.ai.llm import Message, ROLE_SMART
from src.extraction.coerce import coerce_value
from src.extraction.types import ExtractionError, Schema
from src.processing.base import ParsedDocument

logger = logging.getLogger(__name__)

_EXTRACT_SAMPLE_CHARS = 12000


def extract_records(
    parsed: ParsedDocument,
    schema: Schema,
    *,
    gateway: Any | None = None,
    feature: str = "extraction",
    workspace_id: str | None = None,
    run_id: str | None = None,
    max_records: int = 100_000,
) -> list[dict]:
    """Extract a list of schema-shaped records from the parsed document."""
    if not schema.fields:
        raise ExtractionError("Cannot extract without a schema")

    table = parsed.primary_table
    if table is not None and table.column_count > 0:
        return _extract_from_table(table, schema, max_records)

    if gateway is None:
        raise ExtractionError(
            "A gateway is required to extract structured data from text"
        )
    return _extract_from_text(
        parsed.text, schema, gateway, feature, workspace_id, run_id, max_records
    )


def _extract_from_table(table, schema: Schema, max_records: int) -> list[dict]:
    col_index = {name: i for i, name in enumerate(table.columns)}
    records: list[dict] = []
    for row in table.rows[:max_records]:
        record: dict = {}
        for field in schema.fields:
            idx = col_index.get(field.name)
            raw = row[idx] if (idx is not None and idx < len(row)) else None
            coerced, _ok = coerce_value(raw, field.dtype)
            record[field.name] = coerced
        records.append(record)
    return records


def _extract_from_text(
    text: str,
    schema: Schema,
    gateway: Any,
    feature: str,
    workspace_id: str | None,
    run_id: str | None,
    max_records: int,
) -> list[dict]:
    field_desc = ", ".join(f"{f.name} ({f.dtype})" for f in schema.fields)
    messages = [
        Message.system(
            "You are a precise data extraction engine. Extract structured records "
            "from the document. Respond with JSON only in the form "
            '{"records":[{...}]} where each object uses exactly these fields: '
            f"{field_desc}. Use null for missing values."
        ),
        Message.user(f"Document:\n\n{text[:_EXTRACT_SAMPLE_CHARS]}"),
    ]
    try:
        resp = gateway.complete(
            messages,
            role=ROLE_SMART,
            response_format="json",
            feature=feature,
            workspace_id=workspace_id,
            run_id=run_id,
        )
        raw_records = _parse_records(resp.text)
    except ExtractionError:
        raise
    except Exception as exc:  # noqa: BLE001
        raise ExtractionError(f"LLM extraction failed: {exc}") from exc

    records: list[dict] = []
    for raw in raw_records[:max_records]:
        if not isinstance(raw, dict):
            continue
        record: dict = {}
        for field in schema.fields:
            coerced, _ok = coerce_value(raw.get(field.name), field.dtype)
            record[field.name] = coerced
        records.append(record)
    return records


def _parse_records(text: str) -> list:
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ExtractionError(f"Model did not return valid JSON: {exc}") from exc
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ("records", "data", "items", "results"):
            if isinstance(data.get(key), list):
                return data[key]
        return [data]
    raise ExtractionError("Model JSON did not contain records")

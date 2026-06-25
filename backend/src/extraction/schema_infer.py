"""Schema inference.

Tabular sources derive a schema deterministically from their columns and data
types. Document/text sources either use the user's declared target fields or ask
the LLM (via the gateway) to propose a schema from a text sample.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from src.ai.llm import Message, ROLE_SMART
from src.extraction.coerce import infer_dtype
from src.extraction.types import FieldSpec, Schema
from src.processing.base import ParsedDocument

logger = logging.getLogger(__name__)

_SCHEMA_SAMPLE_CHARS = 6000


def infer_schema(
    parsed: ParsedDocument,
    *,
    target_fields: list[str] | None = None,
    gateway: Any | None = None,
    feature: str = "schema_infer",
    workspace_id: str | None = None,
    run_id: str | None = None,
) -> Schema:
    """Infer a schema for the parsed document."""
    table = parsed.primary_table
    if table is not None and table.column_count > 0:
        return _schema_from_table(table, target_fields)

    if target_fields:
        return Schema(fields=[FieldSpec(name=f, dtype="string") for f in target_fields])

    if gateway is not None and parsed.text.strip():
        inferred = _schema_from_text(
            parsed.text, gateway, feature, workspace_id, run_id
        )
        if inferred:
            return inferred

    # Fallback: a single free-text content field (always valid, never empty schema).
    return Schema(fields=[FieldSpec(name="content", dtype="string")])


def _schema_from_table(table, target_fields: list[str] | None) -> Schema:
    columns = table.columns
    col_index = {name: i for i, name in enumerate(columns)}
    selected = target_fields or columns
    fields: list[FieldSpec] = []
    for name in selected:
        if name in col_index:
            idx = col_index[name]
            values = [row[idx] if idx < len(row) else None for row in table.rows]
            fields.append(FieldSpec(name=name, dtype=infer_dtype(values)))
        else:
            # Declared field not present in the source -> string, to be filled best-effort.
            fields.append(FieldSpec(name=name, dtype="string"))
    return Schema(fields=fields)


def _schema_from_text(
    text: str,
    gateway: Any,
    feature: str,
    workspace_id: str | None,
    run_id: str | None,
) -> Schema | None:
    sample = text[:_SCHEMA_SAMPLE_CHARS]
    messages = [
        Message.system(
            "You are a data schema designer. Given a document, propose a flat "
            "schema of fields to extract. Respond with JSON only: "
            '{"fields":[{"name":"...","dtype":"string|integer|float|boolean|'
            'datetime","description":"..."}]}'
        ),
        Message.user(f"Document sample:\n\n{sample}"),
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
        data = json.loads(resp.text)
        schema = Schema.from_dict(data if isinstance(data, dict) else {"fields": data})
        return schema or None
    except Exception as exc:  # noqa: BLE001 - inference is best-effort
        logger.warning("Schema inference via LLM failed: %s", exc)
        return None

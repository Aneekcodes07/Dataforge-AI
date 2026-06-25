"""Synchronous source preview.

Runs a capped slice of the pipeline (fetch -> parse -> infer schema -> extract a
sample -> validate) so the UI can show a real inferred schema, sample rows, and a
preliminary quality score before committing to a full run. No artifact is written.
"""

from __future__ import annotations

from typing import Any

from src.extraction.extractor import extract_records
from src.extraction.schema_infer import infer_schema
from src.extraction.types import ExtractionError
from src.extraction.validation import validate_and_profile
from src.ingestion.source import build_connector
from src.processing import process_raw_document


def preview_source(
    source_type: str,
    config: dict,
    *,
    store: Any | None = None,
    source_file: Any | None = None,
    gateway: Any | None = None,
    sample_records: int = 50,
) -> dict:
    """Return {schema, columns, sampleRows, qualityScore, recordCount} for a source."""
    config = config or {}
    target_fields = config.get("target_fields") or config.get("targetFields")

    connector = build_connector(
        source_type, config, store=store, source_file=source_file
    )
    raw_documents = connector.fetch()
    if not raw_documents:
        raise ExtractionError("Source returned no data")

    parsed = process_raw_document(raw_documents[0], source_type)
    active_gateway = gateway if parsed.primary_table is None else None

    schema = infer_schema(parsed, target_fields=target_fields, gateway=active_gateway)
    records = extract_records(
        parsed, schema, gateway=active_gateway, max_records=sample_records
    )
    validation = validate_and_profile(records, schema)

    return {
        "schema": schema.to_dict()["fields"],
        "columns": [c.to_dict() for c in validation.column_profiles],
        "sampleRows": records[:sample_records],
        "qualityScore": round(validation.quality_score, 2),
        "recordCount": validation.record_count,
        "issues": validation.issues,
    }

"""Persist extracted records as Parquet in object storage and read samples back.

pandas/pyarrow are imported lazily so this module imports without them; the write
and read paths run in environments where the data stack is installed.
"""

from __future__ import annotations

import io
from dataclasses import dataclass

from src.extraction.types import Schema
from src.storage.base import ObjectStore


@dataclass
class ArtifactInfo:
    storage_key: str
    format: str
    row_count: int
    column_count: int
    byte_size: int


def artifact_key(workspace_id: str, dataset_id: str, run_id: str) -> str:
    return f"workspaces/{workspace_id}/datasets/{dataset_id}/artifacts/{run_id}.parquet"


def write_dataset(
    store: ObjectStore,
    records: list[dict],
    schema: Schema,
    *,
    workspace_id: str,
    dataset_id: str,
    run_id: str,
) -> ArtifactInfo:
    """Write records to a Parquet object and return its metadata."""
    import pandas as pd

    columns = schema.names
    frame = (
        pd.DataFrame(records, columns=columns)
        if records
        else pd.DataFrame(columns=columns)
    )
    buffer = io.BytesIO()
    frame.to_parquet(buffer, engine="pyarrow", index=False)
    payload = buffer.getvalue()

    key = artifact_key(workspace_id, dataset_id, run_id)
    store.put_object(key, payload, content_type="application/vnd.apache.parquet")

    return ArtifactInfo(
        storage_key=key,
        format="parquet",
        row_count=len(frame.index),
        column_count=len(columns),
        byte_size=len(payload),
    )


def read_records(
    store: ObjectStore,
    storage_key: str,
    *,
    offset: int = 0,
    limit: int = 50,
) -> tuple[list[str], list[dict]]:
    """Read a page of records from a stored Parquet artifact."""
    columns, rows, _total = read_page(store, storage_key, offset=offset, limit=limit)
    return columns, rows


def read_page(
    store: ObjectStore,
    storage_key: str,
    *,
    offset: int = 0,
    limit: int = 50,
) -> tuple[list[str], list[dict], int]:
    """Read a page of records plus the total row count."""
    import pandas as pd

    payload = store.get_object(storage_key)
    frame = pd.read_parquet(io.BytesIO(payload), engine="pyarrow")
    columns = [str(c) for c in frame.columns]
    total = int(len(frame.index))
    page = frame.iloc[offset : offset + limit]
    records = [
        {col: _json_safe(row[col]) for col in columns} for _, row in page.iterrows()
    ]
    return columns, records, total


def export_records(
    store: ObjectStore, storage_key: str, fmt: str
) -> tuple[bytes, str, str]:
    """Export a stored artifact as csv/json/parquet bytes.

    Returns (payload, media_type, file_extension).
    """
    import pandas as pd

    payload = store.get_object(storage_key)
    if fmt == "parquet":
        return payload, "application/vnd.apache.parquet", "parquet"

    frame = pd.read_parquet(io.BytesIO(payload), engine="pyarrow")
    if fmt == "csv":
        return frame.to_csv(index=False).encode("utf-8"), "text/csv", "csv"
    if fmt == "json":
        return (
            frame.to_json(orient="records").encode("utf-8"),
            "application/json",
            "json",
        )
    raise ValueError(f"Unsupported export format '{fmt}'")


def _json_safe(value):
    try:
        import pandas as pd

        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass
    if hasattr(value, "item"):  # numpy scalar
        return value.item()
    return value

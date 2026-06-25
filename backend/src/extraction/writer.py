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
    import pandas as pd

    payload = store.get_object(storage_key)
    frame = pd.read_parquet(io.BytesIO(payload), engine="pyarrow")
    columns = [str(c) for c in frame.columns]
    page = frame.iloc[offset : offset + limit]
    # Convert to JSON-safe records (NaN -> None).
    records = [
        {col: _json_safe(row[col]) for col in columns} for _, row in page.iterrows()
    ]
    return columns, records


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

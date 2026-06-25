"""Extraction engine tests — tabular paths + validation run offline; the LLM
document path uses a stub gateway; the Parquet writer is exercised when the data
stack is available.
"""

import pytest

from src.ai.llm.base import LLMResponse, Usage
from src.extraction import (
    extract_records,
    infer_schema,
    validate_and_profile,
)
from src.extraction.types import FieldSpec, Schema
from src.processing.base import ParsedDocument, ParsedTable


class StubGateway:
    """Gateway double returning a fixed JSON payload for text extraction."""

    def __init__(self, text: str) -> None:
        self._text = text
        self.calls = 0

    def complete(self, messages, **kwargs) -> LLMResponse:
        self.calls += 1
        return LLMResponse(
            text=self._text, model="stub", provider="stub", usage=Usage(10, 10)
        )


def _table_doc() -> ParsedDocument:
    table = ParsedTable(
        columns=["id", "name", "active"],
        rows=[["1", "Ada", "true"], ["2", "Bob", "false"], ["3", "Cy", "true"]],
    )
    return ParsedDocument(source_type="csv", tables=[table])


def test_infer_schema_from_table_infers_dtypes():
    schema = infer_schema(_table_doc())
    by_name = {f.name: f.dtype for f in schema.fields}
    assert by_name == {"id": "integer", "name": "string", "active": "boolean"}


def test_infer_schema_with_target_fields():
    schema = infer_schema(_table_doc(), target_fields=["name", "missing"])
    assert schema.names == ["name", "missing"]


def test_extract_from_table_coerces_types():
    schema = infer_schema(_table_doc())
    records = extract_records(_table_doc(), schema)
    assert records[0] == {"id": 1, "name": "Ada", "active": True}
    assert records[1]["active"] is False


def test_validate_perfect_dataset_scores_100():
    schema = infer_schema(_table_doc())
    records = extract_records(_table_doc(), schema)
    result = validate_and_profile(records, schema)
    assert result.quality_score == 100.0
    assert all(c.status == "valid" for c in result.column_profiles)
    assert result.record_count == 3


def test_validate_flags_nulls_and_lowers_score():
    schema = Schema(fields=[FieldSpec(name="v", dtype="integer")])
    records = [{"v": 1}, {"v": None}]  # 50% null
    result = validate_and_profile(records, schema)
    assert 0 < result.quality_score < 100
    col = result.column_profiles[0]
    assert col.status == "warning"
    assert col.null_rate == 50.0
    assert any("empty" in issue for issue in result.issues)


def test_validate_empty_records_is_zero():
    schema = infer_schema(_table_doc())
    result = validate_and_profile([], schema)
    assert result.quality_score == 0.0
    assert result.record_count == 0


def test_extract_from_text_uses_gateway_and_coerces():
    doc = ParsedDocument(source_type="pdf", text="Invoice total 42 for Acme")
    schema = Schema(
        fields=[
            FieldSpec(name="vendor", dtype="string"),
            FieldSpec(name="total", dtype="integer"),
        ]
    )
    gateway = StubGateway('{"records": [{"vendor": "Acme", "total": "42"}]}')
    records = extract_records(doc, schema, gateway=gateway)
    assert gateway.calls == 1
    assert records == [{"vendor": "Acme", "total": 42}]


def test_infer_schema_from_text_uses_gateway():
    doc = ParsedDocument(source_type="pdf", text="Some document text")
    gateway = StubGateway(
        '{"fields": [{"name": "title", "dtype": "string"}, '
        '{"name": "year", "dtype": "integer"}]}'
    )
    schema = infer_schema(doc, gateway=gateway)
    assert schema.names == ["title", "year"]


def test_extract_from_text_invalid_json_raises():
    from src.extraction.types import ExtractionError

    doc = ParsedDocument(source_type="pdf", text="text")
    schema = Schema(fields=[FieldSpec(name="a", dtype="string")])
    with pytest.raises(ExtractionError):
        extract_records(doc, schema, gateway=StubGateway("not json"))


def test_writer_roundtrip_when_data_stack_available():
    pytest.importorskip("pandas")
    pytest.importorskip("pyarrow")
    from src.extraction.writer import read_records, write_dataset
    from src.storage import InMemoryObjectStore

    store = InMemoryObjectStore()
    schema = infer_schema(_table_doc())
    records = extract_records(_table_doc(), schema)
    info = write_dataset(
        store,
        records,
        schema,
        workspace_id="w1",
        dataset_id="d1",
        run_id="r1",
    )
    assert info.row_count == 3
    assert info.column_count == 3
    assert store.exists(info.storage_key)

    columns, page = read_records(store, info.storage_key, offset=0, limit=2)
    assert columns == ["id", "name", "active"]
    assert len(page) == 2
    assert page[0]["name"] == "Ada"

"""CSV/JSON parsing + dispatch tests (stdlib only; run offline)."""

import pytest

from src.ingestion.connectors.base import RawDocument
from src.processing.base import ProcessingError
from src.processing.router import process_raw_document
from src.processing.tabular import parse_csv, parse_json


def test_parse_csv_with_header():
    doc = parse_csv(b"name,age\nAda,36\nGrace,40\n")
    table = doc.primary_table
    assert table is not None
    assert table.columns == ["name", "age"]
    assert table.rows == [["Ada", "36"], ["Grace", "40"]]
    assert doc.metadata["delimiter"] == ","


def test_parse_csv_semicolon_delimiter():
    doc = parse_csv(b"a;b;c\n1;2;3\n4;5;6\n")
    table = doc.primary_table
    assert table.columns == ["a", "b", "c"]
    assert table.rows[0] == ["1", "2", "3"]


def test_parse_csv_ragged_rows_are_normalized():
    doc = parse_csv(b"a,b,c\n1,2\n4,5,6,7\n")
    table = doc.primary_table
    assert table.rows[0] == ["1", "2", None]
    assert table.rows[1] == ["4", "5", "6"]


def test_parse_csv_empty_raises():
    with pytest.raises(ProcessingError):
        parse_csv(b"   \n")


def test_parse_json_list_of_objects():
    doc = parse_json(b'[{"id": 1, "name": "x"}, {"id": 2, "city": "y"}]')
    table = doc.primary_table
    assert table.columns == ["id", "name", "city"]
    assert table.rows[0] == [1, "x", None]
    assert table.rows[1] == [2, None, "y"]


def test_parse_json_wrapped_list():
    doc = parse_json(b'{"results": [{"a": 1}, {"a": 2}], "page": 1}')
    table = doc.primary_table
    assert table.columns == ["a"]
    assert [r[0] for r in table.rows] == [1, 2]


def test_parse_jsonl():
    doc = parse_json(b'{"a": 1}\n{"a": 2}\n')
    table = doc.primary_table
    assert [r[0] for r in table.rows] == [1, 2]


def test_parse_json_nested_values_are_stringified():
    doc = parse_json(b'[{"id": 1, "tags": ["a", "b"]}]')
    table = doc.primary_table
    assert table.rows[0][1] == '["a", "b"]'


def test_dispatch_csv():
    raw = RawDocument(content=b"x,y\n1,2\n", content_type="text/csv", filename="d.csv")
    doc = process_raw_document(raw, "csv")
    assert doc.source_type == "csv"
    assert doc.primary_table.columns == ["x", "y"]


def test_dispatch_remote_json_by_content_type():
    raw = RawDocument(
        content=b'[{"a": 1}]', content_type="application/json", source_uri="https://x"
    )
    doc = process_raw_document(raw, "api")
    assert doc.primary_table.columns == ["a"]


def test_dispatch_unknown_source_type_raises():
    with pytest.raises(ProcessingError):
        process_raw_document(RawDocument(content=b"x"), "mystery")

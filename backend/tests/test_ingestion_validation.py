"""Upload validation tests (pure stdlib; run without network or extra deps)."""

import pytest

from src.ingestion.validation import UploadValidationError, validate_upload


def test_pdf_accepted_with_magic():
    ct = validate_upload("pdf", "report.pdf", b"%PDF-1.7\n%abc")
    assert ct == "application/pdf"


def test_pdf_rejected_wrong_magic():
    with pytest.raises(UploadValidationError):
        validate_upload("pdf", "report.pdf", b"not a pdf at all")


def test_pdf_rejected_wrong_extension():
    with pytest.raises(UploadValidationError):
        validate_upload("pdf", "report.txt", b"%PDF-1.7")


def test_csv_accepted_text():
    ct = validate_upload("csv", "data.csv", b"col1,col2\n1,2\n")
    assert ct == "text/csv"


def test_csv_rejected_binary():
    with pytest.raises(UploadValidationError):
        validate_upload("csv", "data.csv", b"col1\x00col2")


def test_excel_xlsx_accepted_zip_magic():
    ct = validate_upload("excel", "sheet.xlsx", b"PK\x03\x04rest")
    assert "spreadsheetml" in ct


def test_excel_legacy_xls_ole_magic():
    ct = validate_upload("excel", "sheet.xls", b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1")
    assert "spreadsheetml" in ct


def test_image_png_accepted():
    ct = validate_upload("image", "pic.png", b"\x89PNG\r\n\x1a\nIHDR")
    assert ct == "image/*"


def test_image_jpeg_accepted():
    ct = validate_upload("image", "pic.jpg", b"\xff\xd8\xff\xe0")
    assert ct == "image/*"


def test_json_accepted():
    ct = validate_upload("json", "data.json", b'{"key": "value"}')
    assert ct == "application/json"


def test_unsupported_source_type_rejected():
    with pytest.raises(UploadValidationError):
        validate_upload("url", "whatever.html", b"<html></html>")

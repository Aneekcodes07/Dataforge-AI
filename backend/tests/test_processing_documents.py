"""Document parser tests for PDF / Excel / image / HTML.

These require the document-processing stack (PyMuPDF, openpyxl, Pillow,
BeautifulSoup) and so are skipped automatically where those libraries are not
installed. Fixtures are generated in-process to avoid binary test assets.
"""

import io

import pytest

from src.processing.base import ParsedDocument


def test_parse_html_extracts_text_and_table():
    pytest.importorskip("bs4")
    from src.processing.web import parse_html

    html = b"""
    <html><head><title>Report</title></head>
    <body>
      <script>ignore()</script>
      <h1>Quarterly</h1>
      <p>Revenue summary.</p>
      <table>
        <tr><th>Region</th><th>Sales</th></tr>
        <tr><td>EU</td><td>100</td></tr>
        <tr><td>US</td><td>200</td></tr>
      </table>
    </body></html>
    """
    doc = parse_html(html, source_uri="https://example.com/report")
    assert "Quarterly" in doc.text
    assert "ignore()" not in doc.text
    assert doc.metadata["title"] == "Report"
    table = doc.primary_table
    assert table.columns == ["Region", "Sales"]
    assert table.rows == [["EU", "100"], ["US", "200"]]


def test_parse_excel_roundtrip():
    pytest.importorskip("openpyxl")
    from openpyxl import Workbook

    from src.processing.tabular import parse_excel

    wb = Workbook()
    ws = wb.active
    ws.title = "Sheet1"
    ws.append(["product", "qty"])
    ws.append(["widget", 10])
    ws.append(["gadget", 5])
    buffer = io.BytesIO()
    wb.save(buffer)

    doc = parse_excel(buffer.getvalue())
    table = doc.primary_table
    assert table.columns == ["product", "qty"]
    assert table.rows == [["widget", 10], ["gadget", 5]]


def test_parse_pdf_native_text():
    fitz = pytest.importorskip("fitz")
    from src.processing.pdf import parse_pdf

    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), "Hello DataForge PDF")
    pdf_bytes = doc.tobytes()
    doc.close()

    parsed: ParsedDocument = parse_pdf(pdf_bytes, enable_ocr=False)
    assert "Hello DataForge PDF" in parsed.text
    assert parsed.page_count == 1


def test_parse_image_metadata_without_ocr():
    pytest.importorskip("PIL")
    from PIL import Image

    from src.processing.image import parse_image

    buffer = io.BytesIO()
    Image.new("RGB", (40, 20), color=(255, 255, 255)).save(buffer, format="PNG")

    # enable_ocr=False so the test does not require the Tesseract binary.
    doc = parse_image(buffer.getvalue(), enable_ocr=False)
    assert doc.metadata["width"] == 40
    assert doc.metadata["height"] == 20
    assert doc.metadata["format"] == "PNG"

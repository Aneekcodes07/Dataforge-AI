"""PDF parsing: native text (PyMuPDF) + tables (pdfplumber) + OCR fallback.

Pages with an embedded text layer are read directly. Pages with no extractable
text (scanned documents) are rasterized with PyMuPDF and passed through the OCR
engine. A page cap bounds work and guards against decompression-style abuse.
"""

from __future__ import annotations

import io

from src.processing.base import ParsedDocument, ParsedTable, ProcessingError
from src.processing.ocr import OCREngine, get_ocr_engine

_OCR_ZOOM = 2.0  # ~144 DPI render for OCR legibility


def parse_pdf(
    content: bytes,
    *,
    ocr_engine: OCREngine | None = None,
    enable_ocr: bool = True,
    max_pages: int = 500,
) -> ParsedDocument:
    """Parse a PDF into text + detected tables, OCR-ing image-only pages."""
    try:
        import fitz  # PyMuPDF
    except ImportError as exc:  # pragma: no cover - environment guard
        raise ProcessingError("PyMuPDF (fitz) is required to parse PDFs") from exc

    try:
        document = fitz.open(stream=content, filetype="pdf")
    except Exception as exc:  # noqa: BLE001
        raise ProcessingError(f"Unable to open PDF: {exc}") from exc

    page_texts: list[str] = []
    ocr_page_count = 0
    engine = ocr_engine

    try:
        total_pages = min(document.page_count, max_pages)
        for page_index in range(total_pages):
            page = document.load_page(page_index)
            text = page.get_text("text").strip()
            if not text and enable_ocr:
                if engine is None:
                    engine = get_ocr_engine()
                pixmap = page.get_pixmap(matrix=fitz.Matrix(_OCR_ZOOM, _OCR_ZOOM))
                text = engine.image_to_text(pixmap.tobytes("png"))
                if text:
                    ocr_page_count += 1
            if text:
                page_texts.append(text)
    finally:
        document.close()

    tables = _extract_tables(content)

    return ParsedDocument(
        source_type="pdf",
        text="\n\n".join(page_texts),
        tables=tables,
        page_count=total_pages,
        metadata={"ocr_pages": ocr_page_count, "table_count": len(tables)},
    )


def _extract_tables(content: bytes) -> list[ParsedTable]:
    """Extract tables with pdfplumber; failures degrade to no tables."""
    try:
        import pdfplumber
    except ImportError:  # pragma: no cover - environment guard
        return []

    tables: list[ParsedTable] = []
    try:
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            for page in pdf.pages:
                for raw in page.extract_tables() or []:
                    if not raw or len(raw) < 2:
                        continue
                    header = [
                        (str(c).strip() if c is not None else f"column_{i + 1}")
                        for i, c in enumerate(raw[0])
                    ]
                    rows = [list(r) for r in raw[1:]]
                    tables.append(ParsedTable(columns=header, rows=rows))
    except Exception:  # noqa: BLE001 - table extraction is best-effort
        return tables
    return tables

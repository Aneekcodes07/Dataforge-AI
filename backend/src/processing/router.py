"""Dispatch a RawDocument to the correct parser based on source/content type."""

from __future__ import annotations

from src.ingestion.connectors.base import RawDocument
from src.processing.base import ParsedDocument, ProcessingError
from src.processing.image import parse_image
from src.processing.ocr import OCREngine
from src.processing.pdf import parse_pdf
from src.processing.tabular import parse_csv, parse_excel, parse_json
from src.processing.web import parse_html


def _decode(content: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue
    return content.decode("utf-8", errors="replace")


def process_raw_document(
    raw: RawDocument,
    source_type: str,
    *,
    ocr_engine: OCREngine | None = None,
    enable_ocr: bool = True,
) -> ParsedDocument:
    """Parse a raw payload into the normalized document IR.

    For uploaded files the declared ``source_type`` selects the parser. For
    remote ``url``/``api`` sources the response Content-Type is used to choose
    between JSON, CSV, HTML, PDF, and plain text.
    """
    stype = source_type.lower()

    if stype == "csv":
        return parse_csv(raw.content, name=raw.filename)
    if stype == "excel":
        return parse_excel(raw.content)
    if stype == "json":
        return parse_json(raw.content)
    if stype == "pdf":
        return parse_pdf(raw.content, ocr_engine=ocr_engine, enable_ocr=enable_ocr)
    if stype == "image":
        return parse_image(raw.content, ocr_engine=ocr_engine, enable_ocr=enable_ocr)

    if stype in ("url", "api"):
        return _process_remote(raw, stype, ocr_engine, enable_ocr)

    raise ProcessingError(f"Unsupported source type '{source_type}'")


def _process_remote(
    raw: RawDocument,
    stype: str,
    ocr_engine: OCREngine | None,
    enable_ocr: bool,
) -> ParsedDocument:
    content_type = (raw.content_type or "").lower()

    if "json" in content_type:
        return parse_json(raw.content)
    if "csv" in content_type:
        return parse_csv(raw.content, name=raw.filename)
    if "pdf" in content_type:
        return parse_pdf(raw.content, ocr_engine=ocr_engine, enable_ocr=enable_ocr)
    if "html" in content_type or "xml" in content_type or not content_type:
        return parse_html(raw.content, source_uri=raw.source_uri)

    # Plain text / unknown textual content.
    return ParsedDocument(
        source_type=stype,
        text=_decode(raw.content),
        metadata={"content_type": content_type, "source_uri": raw.source_uri},
    )

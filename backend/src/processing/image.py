"""Image parsing: metadata (Pillow) + OCR text (Tesseract).

This produces real text and metadata now. Higher-level semantic image
understanding via a vision LLM is layered on in M1.3 once the LLM gateway exists.
"""

from __future__ import annotations

import io

from src.processing.base import ParsedDocument, ProcessingError
from src.processing.ocr import OCREngine, get_ocr_engine


def parse_image(
    content: bytes,
    *,
    ocr_engine: OCREngine | None = None,
    enable_ocr: bool = True,
) -> ParsedDocument:
    """Extract image metadata and any embedded text via OCR."""
    try:
        from PIL import Image
    except ImportError as exc:  # pragma: no cover - environment guard
        raise ProcessingError("Pillow is required to parse images") from exc

    try:
        with Image.open(io.BytesIO(content)) as image:
            metadata = {
                "format": image.format,
                "mode": image.mode,
                "width": image.width,
                "height": image.height,
            }
    except Exception as exc:  # noqa: BLE001
        raise ProcessingError(f"Unable to read image: {exc}") from exc

    text = ""
    if enable_ocr:
        engine = ocr_engine or get_ocr_engine()
        text = engine.image_to_text(content)

    return ParsedDocument(source_type="image", text=text, metadata=metadata)

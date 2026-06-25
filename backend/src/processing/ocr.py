"""OCR engine abstraction.

Defaults to Tesseract (free, offline) via pytesseract. The abstraction lets a
cloud OCR backend (Textract/Vision) be substituted later without touching call
sites. Heavy imports are lazy so this module imports without the OCR stack.
"""

from __future__ import annotations

import abc

from src.processing.base import ProcessingError


class OCREngine(abc.ABC):
    """Extracts text from raster image bytes."""

    @abc.abstractmethod
    def image_to_text(self, image_bytes: bytes) -> str: ...


class TesseractOCREngine(OCREngine):
    """OCR backend using the local Tesseract binary via pytesseract."""

    def __init__(self, lang: str = "eng") -> None:
        self.lang = lang

    def image_to_text(self, image_bytes: bytes) -> str:
        try:
            import io

            import pytesseract
            from PIL import Image
        except ImportError as exc:  # pragma: no cover - environment guard
            raise ProcessingError(
                "pytesseract and Pillow are required for OCR"
            ) from exc

        try:
            with Image.open(io.BytesIO(image_bytes)) as image:
                return pytesseract.image_to_string(image, lang=self.lang).strip()
        except Exception as exc:  # noqa: BLE001 - normalize OCR failures
            raise ProcessingError(f"OCR failed: {exc}") from exc


_default_engine: OCREngine | None = None


def get_ocr_engine() -> OCREngine:
    """Return a process-wide default OCR engine."""
    global _default_engine
    if _default_engine is None:
        _default_engine = TesseractOCREngine()
    return _default_engine

"""Document processing — raw payloads to a normalized ParsedDocument IR."""

from src.processing.base import ParsedDocument, ParsedTable, ProcessingError
from src.processing.ocr import OCREngine, TesseractOCREngine, get_ocr_engine
from src.processing.router import process_raw_document

__all__ = [
    "ParsedDocument",
    "ParsedTable",
    "ProcessingError",
    "OCREngine",
    "TesseractOCREngine",
    "get_ocr_engine",
    "process_raw_document",
]

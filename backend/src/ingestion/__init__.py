"""Ingestion package — acquire raw payloads from uploads, URLs, and APIs."""

from src.ingestion.security import SsrfError, assert_safe_url
from src.ingestion.validation import (
    FILE_SOURCE_TYPES,
    UploadValidationError,
    validate_upload,
)

__all__ = [
    "SsrfError",
    "assert_safe_url",
    "validate_upload",
    "UploadValidationError",
    "FILE_SOURCE_TYPES",
]

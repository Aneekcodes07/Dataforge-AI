"""Upload validation.

Validates uploaded source files against the declared source type using both the
filename extension and the file's leading "magic" bytes. Implemented with the
standard library only (no libmagic system dependency) so it stays portable and
fully unit-testable. Deep parsing/validation happens later in the processing
stage; this layer only rejects obviously-wrong or unsafe uploads at the edge.
"""

from __future__ import annotations

from dataclasses import dataclass


class UploadValidationError(ValueError):
    """Raised when an uploaded file fails validation."""


# Declared source type -> (allowed extensions, canonical content type)
_EXTENSIONS: dict[str, tuple[set[str], str]] = {
    "pdf": ({".pdf"}, "application/pdf"),
    "csv": ({".csv", ".tsv", ".txt"}, "text/csv"),
    "excel": (
        {".xlsx", ".xls"},
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ),
    "json": ({".json", ".jsonl", ".ndjson"}, "application/json"),
    "image": ({".png", ".jpg", ".jpeg", ".gif", ".webp"}, "image/*"),
}

# Source types that carry an uploaded file (vs. url/api which fetch remotely).
FILE_SOURCE_TYPES = frozenset(_EXTENSIONS.keys())


@dataclass(frozen=True)
class MagicSignature:
    offset: int
    prefix: bytes


# Leading-byte signatures for the binary formats we accept.
_MAGIC: dict[str, list[MagicSignature]] = {
    "pdf": [MagicSignature(0, b"%PDF-")],
    # xlsx/xls: xlsx is a ZIP (PK\x03\x04); legacy .xls is an OLE2 compound file.
    "excel": [
        MagicSignature(0, b"PK\x03\x04"),
        MagicSignature(0, b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"),
    ],
    "image": [
        MagicSignature(0, b"\x89PNG\r\n\x1a\n"),  # png
        MagicSignature(0, b"\xff\xd8\xff"),  # jpeg
        MagicSignature(0, b"GIF87a"),  # gif
        MagicSignature(0, b"GIF89a"),  # gif
        MagicSignature(0, b"RIFF"),  # webp container (RIFF....WEBP)
    ],
}


def _extension(filename: str) -> str:
    name = filename.lower().strip()
    dot = name.rfind(".")
    return name[dot:] if dot != -1 else ""


def _matches_magic(source_type: str, head: bytes) -> bool:
    signatures = _MAGIC.get(source_type)
    if not signatures:
        return True  # text formats (csv/json) are validated by decodability instead
    for sig in signatures:
        if head[sig.offset : sig.offset + len(sig.prefix)] == sig.prefix:
            return True
    return False


def _looks_like_text(head: bytes) -> bool:
    """Heuristic: the head decodes as UTF-8/Latin-1 and has no NUL bytes."""
    if b"\x00" in head:
        return False
    try:
        head.decode("utf-8")
        return True
    except UnicodeDecodeError:
        try:
            head.decode("latin-1")
            return True
        except UnicodeDecodeError:
            return False


def validate_upload(source_type: str, filename: str, head: bytes) -> str:
    """Validate an uploaded file and return its canonical content type.

    Args:
        source_type: declared dataset source type (pdf/csv/excel/json/image).
        filename: original client filename.
        head: the first bytes of the file (>= 16 bytes recommended) for sniffing.

    Raises:
        UploadValidationError: on unsupported type, wrong extension, or content
        that does not match the declared type.
    """
    stype = source_type.lower()
    if stype not in _EXTENSIONS:
        raise UploadValidationError(
            f"Source type '{source_type}' does not accept file uploads"
        )

    allowed_exts, content_type = _EXTENSIONS[stype]
    ext = _extension(filename)
    if ext not in allowed_exts:
        raise UploadValidationError(
            f"File extension '{ext or '(none)'}' is not valid for {stype}; "
            f"expected one of {', '.join(sorted(allowed_exts))}"
        )

    if not _matches_magic(stype, head):
        raise UploadValidationError(f"File contents do not match a valid {stype} file")

    if stype in ("csv", "json") and not _looks_like_text(head):
        raise UploadValidationError(f"File does not appear to be valid {stype} text")

    return content_type

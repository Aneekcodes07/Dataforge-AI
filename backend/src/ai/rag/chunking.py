"""Text chunking for embedding/retrieval (standard library only)."""

from __future__ import annotations


def chunk_text(text: str, *, max_chars: int = 1200, overlap: int = 150) -> list[str]:
    """Split text into overlapping chunks, preferring whitespace boundaries.

    ``overlap`` is clamped below ``max_chars`` and the cursor always advances, so
    this terminates for any input.
    """
    text = (text or "").strip()
    if not text:
        return []
    if len(text) <= max_chars:
        return [text]

    overlap = max(0, min(overlap, max_chars // 2))
    chunks: list[str] = []
    start = 0
    length = len(text)

    while start < length:
        end = min(start + max_chars, length)
        if end < length:
            # Prefer to break at the last whitespace within the window.
            window_start = max(start + max_chars - overlap, start + 1)
            space = text.rfind(" ", window_start, end)
            if space > start:
                end = space
        piece = text[start:end].strip()
        if piece:
            chunks.append(piece)
        if end >= length:
            break
        start = max(end - overlap, start + 1)

    return chunks


def records_to_text(columns: list[str], rows: list[list]) -> str:
    """Serialize tabular rows into a newline-delimited, embeddable text block."""
    lines: list[str] = []
    for row in rows:
        parts = []
        for i, col in enumerate(columns):
            value = row[i] if i < len(row) else None
            if value is None or value == "":
                continue
            parts.append(f"{col}: {value}")
        if parts:
            lines.append("; ".join(parts))
    return "\n".join(lines)

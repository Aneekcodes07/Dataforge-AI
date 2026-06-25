"""HTML parsing for web/API sources — extract readable text and any tables."""

from __future__ import annotations

from src.processing.base import ParsedDocument, ParsedTable, ProcessingError


def parse_html(content: bytes, *, source_uri: str | None = None) -> ParsedDocument:
    """Extract visible text and HTML tables from a web page."""
    try:
        from bs4 import BeautifulSoup
    except ImportError as exc:  # pragma: no cover - environment guard
        raise ProcessingError("beautifulsoup4 is required to parse HTML") from exc

    soup = BeautifulSoup(content, "html.parser")

    # Drop non-content elements before extracting text.
    for tag in soup(["script", "style", "noscript", "template"]):
        tag.decompose()

    title = soup.title.string.strip() if soup.title and soup.title.string else None
    text = soup.get_text(separator="\n", strip=True)

    tables: list[ParsedTable] = []
    for table_el in soup.find_all("table"):
        parsed = _parse_html_table(table_el)
        if parsed is not None:
            tables.append(parsed)

    metadata: dict = {"table_count": len(tables)}
    if title:
        metadata["title"] = title
    if source_uri:
        metadata["source_uri"] = source_uri

    return ParsedDocument(
        source_type="url", text=text, tables=tables, metadata=metadata
    )


def _parse_html_table(table_el) -> ParsedTable | None:
    rows = table_el.find_all("tr")
    if not rows:
        return None

    parsed_rows: list[list[str]] = []
    for tr in rows:
        cells = tr.find_all(["th", "td"])
        if cells:
            parsed_rows.append([c.get_text(strip=True) for c in cells])
    if len(parsed_rows) < 2:
        return None

    header = parsed_rows[0]
    width = len(header)
    body: list[list] = []
    for row in parsed_rows[1:]:
        if len(row) < width:
            row = row + [None] * (width - len(row))
        body.append(row[:width])
    return ParsedTable(columns=header, rows=body)

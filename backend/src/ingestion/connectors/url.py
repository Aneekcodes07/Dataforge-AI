"""URL connector — SSRF-safe HTTP(S) fetch with manual redirect validation."""

from __future__ import annotations

from urllib.parse import urljoin

from src.ingestion.connectors.base import (
    BaseConnector,
    IngestionError,
    PayloadTooLargeError,
    RawDocument,
)
from src.ingestion.security import SsrfError, assert_safe_url

DEFAULT_USER_AGENT = "DataForgeAI/1.0 (+https://dataforge.ai)"
_REDIRECT_STATUSES = {301, 302, 303, 307, 308}


class UrlConnector(BaseConnector):
    """Fetches a single web resource.

    Every hop (including each redirect target) is re-validated by the SSRF guard,
    redirects are followed manually (not by the HTTP client), and the response
    body is capped at ``max_bytes`` while streaming.
    """

    def __init__(
        self,
        url: str,
        *,
        timeout: float = 30.0,
        max_bytes: int = 25 * 1024 * 1024,
        max_redirects: int = 5,
        user_agent: str = DEFAULT_USER_AGENT,
        headers: dict[str, str] | None = None,
    ) -> None:
        self.url = url
        self.timeout = timeout
        self.max_bytes = max_bytes
        self.max_redirects = max_redirects
        self.headers = {"User-Agent": user_agent, **(headers or {})}

    def fetch(self) -> list[RawDocument]:
        import httpx

        current = self.url
        with httpx.Client(
            timeout=self.timeout, follow_redirects=False, headers=self.headers
        ) as client:
            for _ in range(self.max_redirects + 1):
                assert_safe_url(current)
                with client.stream("GET", current) as resp:
                    if resp.status_code in _REDIRECT_STATUSES:
                        location = resp.headers.get("location")
                        if not location:
                            raise IngestionError(
                                f"Redirect from {current} without a Location header"
                            )
                        current = urljoin(current, location)
                        continue

                    resp.raise_for_status()
                    chunks: list[bytes] = []
                    total = 0
                    for chunk in resp.iter_bytes():
                        total += len(chunk)
                        if total > self.max_bytes:
                            raise PayloadTooLargeError(
                                f"Response exceeded {self.max_bytes} bytes"
                            )
                        chunks.append(chunk)
                    return [
                        RawDocument(
                            content=b"".join(chunks),
                            content_type=resp.headers.get("content-type"),
                            source_uri=str(resp.url),
                            metadata={"status_code": resp.status_code},
                        )
                    ]
        raise SsrfError(f"Exceeded maximum redirects ({self.max_redirects})")

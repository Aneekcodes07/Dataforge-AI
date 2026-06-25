"""API connector — SSRF-safe REST fetch for JSON/text endpoints."""

from __future__ import annotations

from src.ingestion.connectors.base import (
    BaseConnector,
    PayloadTooLargeError,
    RawDocument,
)
from src.ingestion.security import assert_safe_url

DEFAULT_USER_AGENT = "DataForgeAI/1.0 (+https://dataforge.ai)"


class ApiConnector(BaseConnector):
    """Performs a single authenticated REST request and returns the payload."""

    def __init__(
        self,
        endpoint: str,
        *,
        method: str = "GET",
        headers: dict[str, str] | None = None,
        params: dict[str, str] | None = None,
        json_body: dict | None = None,
        timeout: float = 30.0,
        max_bytes: int = 25 * 1024 * 1024,
    ) -> None:
        self.endpoint = endpoint
        self.method = method.upper()
        self.headers = {"User-Agent": DEFAULT_USER_AGENT, **(headers or {})}
        self.params = params or {}
        self.json_body = json_body
        self.timeout = timeout
        self.max_bytes = max_bytes

    def fetch(self) -> list[RawDocument]:
        import httpx

        assert_safe_url(self.endpoint)
        with httpx.Client(
            timeout=self.timeout, follow_redirects=False, headers=self.headers
        ) as client:
            resp = client.request(
                self.method,
                self.endpoint,
                params=self.params,
                json=self.json_body,
            )
            resp.raise_for_status()
            content = resp.content
            if len(content) > self.max_bytes:
                raise PayloadTooLargeError(f"Response exceeded {self.max_bytes} bytes")
            return [
                RawDocument(
                    content=content,
                    content_type=resp.headers.get("content-type", "application/json"),
                    source_uri=str(resp.url),
                    metadata={"status_code": resp.status_code, "method": self.method},
                )
            ]

"""Deterministic mock provider.

Used by the unit suite and, when ``AI_ALLOW_MOCK=true`` and no real provider key
is configured, for local/offline development. It is never selected silently in
production: enabling it requires the explicit ``AI_ALLOW_MOCK`` opt-in. Outputs
are deterministic functions of the input so tests are stable.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
from typing import Iterator, Sequence

from src.ai.llm.base import (
    EmbeddingResponse,
    LLMProvider,
    LLMResponse,
    Message,
    StreamChunk,
    Usage,
)


def _estimate_tokens(text: str) -> int:
    # Cheap, stable token estimate (~4 chars/token) used for mock accounting.
    return max(1, math.ceil(len(text) / 4))


class MockProvider(LLMProvider):
    """A deterministic, dependency-free LLM provider for tests and dev."""

    name = "mock"

    def __init__(self, embed_dim: int = 1536) -> None:
        self.embed_dim = embed_dim

    def _render(self, messages: Sequence[Message], response_format: str | None) -> str:
        last_user = next(
            (m.content for m in reversed(messages) if m.role == "user"),
            "",
        )
        if response_format == "json":
            # Produce valid JSON echoing a deterministic structure.
            return json.dumps(
                {"echo": last_user[:200], "mock": True},
                ensure_ascii=False,
            )
        return f"[mock:{self.name}] {last_user.strip()}".strip()

    def complete(
        self,
        messages: Sequence[Message],
        *,
        model: str,
        temperature: float = 0.2,
        max_tokens: int | None = None,
        response_format: str | None = None,
    ) -> LLMResponse:
        text = self._render(messages, response_format)
        prompt_tokens = sum(_estimate_tokens(m.content) for m in messages)
        return LLMResponse(
            text=text,
            model=model,
            provider=self.name,
            usage=Usage(
                prompt_tokens=prompt_tokens,
                completion_tokens=_estimate_tokens(text),
            ),
            finish_reason="stop",
        )

    def stream(
        self,
        messages: Sequence[Message],
        *,
        model: str,
        temperature: float = 0.2,
        max_tokens: int | None = None,
    ) -> Iterator[StreamChunk]:
        full = self._render(messages, None)
        tokens = re.findall(r"\S+\s*", full) or [full]
        prompt_tokens = sum(_estimate_tokens(m.content) for m in messages)
        for tok in tokens:
            yield StreamChunk(delta=tok)
        yield StreamChunk(
            delta="",
            usage=Usage(
                prompt_tokens=prompt_tokens,
                completion_tokens=_estimate_tokens(full),
            ),
            finish_reason="stop",
        )

    def embed(self, inputs: Sequence[str], *, model: str) -> EmbeddingResponse:
        vectors = [self._embed_one(text) for text in inputs]
        return EmbeddingResponse(
            embeddings=vectors,
            model=model,
            provider=self.name,
            usage=Usage(prompt_tokens=sum(_estimate_tokens(t) for t in inputs)),
        )

    def _embed_one(self, text: str) -> list[float]:
        """Deterministic unit-norm pseudo-embedding seeded by the text hash."""
        seed = hashlib.sha256(text.encode("utf-8")).digest()
        # Expand the 32-byte digest deterministically to embed_dim floats.
        raw: list[float] = []
        counter = 0
        while len(raw) < self.embed_dim:
            block = hashlib.sha256(seed + counter.to_bytes(4, "big")).digest()
            for byte in block:
                raw.append((byte / 255.0) * 2.0 - 1.0)
                if len(raw) >= self.embed_dim:
                    break
            counter += 1
        norm = math.sqrt(sum(v * v for v in raw)) or 1.0
        return [v / norm for v in raw]

    def vision(
        self,
        messages: Sequence[Message],
        images: Sequence[bytes],
        *,
        model: str,
        temperature: float = 0.2,
        max_tokens: int | None = None,
    ) -> LLMResponse:
        prompt = self._render(messages, None)
        text = f"{prompt} [images:{len(images)}]"
        return LLMResponse(
            text=text,
            model=model,
            provider=self.name,
            usage=Usage(prompt_tokens=_estimate_tokens(prompt), completion_tokens=8),
            finish_reason="stop",
        )

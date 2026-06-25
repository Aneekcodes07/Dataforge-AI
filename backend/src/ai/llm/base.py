"""Core LLM types, provider contract, error hierarchy, and usage recording.

This module imports nothing beyond the standard library so the gateway, model
registry, and mock provider can be imported and unit-tested without any provider
SDK, prometheus, or a database.
"""

from __future__ import annotations

import abc
import enum
from dataclasses import dataclass, field
from typing import Iterator, Protocol, Sequence, runtime_checkable


class Role(str, enum.Enum):
    system = "system"
    user = "user"
    assistant = "assistant"


@dataclass
class Message:
    role: str
    content: str

    @staticmethod
    def system(content: str) -> "Message":
        return Message(role=Role.system.value, content=content)

    @staticmethod
    def user(content: str) -> "Message":
        return Message(role=Role.user.value, content=content)

    @staticmethod
    def assistant(content: str) -> "Message":
        return Message(role=Role.assistant.value, content=content)


@dataclass
class Usage:
    prompt_tokens: int = 0
    completion_tokens: int = 0

    @property
    def total_tokens(self) -> int:
        return self.prompt_tokens + self.completion_tokens


@dataclass
class LLMResponse:
    text: str
    model: str
    provider: str
    usage: Usage = field(default_factory=Usage)
    finish_reason: str | None = None


@dataclass
class EmbeddingResponse:
    embeddings: list[list[float]]
    model: str
    provider: str
    usage: Usage = field(default_factory=Usage)


@dataclass
class StreamChunk:
    """A streamed token delta. The final chunk may carry final usage."""

    delta: str
    usage: Usage | None = None
    finish_reason: str | None = None


# --------------------------------------------------------------------------- #
# Error hierarchy
# --------------------------------------------------------------------------- #


class LLMError(Exception):
    """Base class for all LLM errors."""


class ProviderError(LLMError):
    """A provider-side error. Carries the provider name for diagnostics."""

    def __init__(self, message: str, *, provider: str | None = None) -> None:
        super().__init__(message)
        self.provider = provider


class TransientError(ProviderError):
    """A retryable error (timeout, connection reset, 5xx)."""


class RateLimitError(TransientError):
    """Provider rate limit / 429 — retryable with backoff."""


class AuthenticationError(ProviderError):
    """Invalid/missing credentials — not retryable."""


class BadRequestError(ProviderError):
    """Malformed request / 4xx — not retryable."""


class ContentFilterError(ProviderError):
    """Request blocked by the provider's content policy — not retryable."""


class ProviderNotConfiguredError(LLMError):
    """No usable provider is configured for the requested operation."""


# --------------------------------------------------------------------------- #
# Provider contract
# --------------------------------------------------------------------------- #


class LLMProvider(abc.ABC):
    """A concrete model provider (OpenAI, Anthropic, Gemini, Mock)."""

    name: str = "base"

    @abc.abstractmethod
    def complete(
        self,
        messages: Sequence[Message],
        *,
        model: str,
        temperature: float = 0.2,
        max_tokens: int | None = None,
        response_format: str | None = None,
    ) -> LLMResponse: ...

    @abc.abstractmethod
    def stream(
        self,
        messages: Sequence[Message],
        *,
        model: str,
        temperature: float = 0.2,
        max_tokens: int | None = None,
    ) -> Iterator[StreamChunk]: ...

    def embed(
        self, inputs: Sequence[str], *, model: str
    ) -> EmbeddingResponse:  # pragma: no cover - default
        raise ProviderNotConfiguredError(
            f"Provider '{self.name}' does not support embeddings"
        )

    def vision(
        self,
        messages: Sequence[Message],
        images: Sequence[bytes],
        *,
        model: str,
        temperature: float = 0.2,
        max_tokens: int | None = None,
    ) -> LLMResponse:  # pragma: no cover - default
        raise ProviderNotConfiguredError(
            f"Provider '{self.name}' does not support vision"
        )


# --------------------------------------------------------------------------- #
# Usage recording (injected into the gateway; concrete impl lives in usage.py)
# --------------------------------------------------------------------------- #


@dataclass
class UsageEvent:
    feature: str
    provider: str
    model: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    cost_usd: float
    latency_ms: int
    status: str
    workspace_id: str | None = None
    user_id: str | None = None
    run_id: str | None = None


@runtime_checkable
class UsageRecorder(Protocol):
    def record(self, event: UsageEvent) -> None: ...


class NullUsageRecorder:
    """Default recorder that drops events (used when no recorder is wired)."""

    def record(self, event: UsageEvent) -> None:  # noqa: D401 - no-op
        return None

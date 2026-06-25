"""LLM package.

Top-level imports are limited to dependency-free modules (no provider SDKs, no
prometheus, no DB) so the gateway and mock provider are importable in any
environment. :func:`get_gateway` lazily wires the production providers and the
Prometheus/DB usage recorder.
"""

from __future__ import annotations

from functools import lru_cache

from src.ai.llm.base import (
    EmbeddingResponse,
    LLMError,
    LLMProvider,
    LLMResponse,
    Message,
    ProviderError,
    ProviderNotConfiguredError,
    StreamChunk,
    Usage,
    UsageEvent,
)
from src.ai.llm.gateway import CircuitBreaker, LLMGateway
from src.ai.llm.mock_provider import MockProvider
from src.ai.llm.registry import (
    ROLE_EMBED,
    ROLE_FAST,
    ROLE_SMART,
    ROLE_VISION,
    ModelRegistry,
)

__all__ = [
    "Message",
    "Usage",
    "LLMResponse",
    "EmbeddingResponse",
    "StreamChunk",
    "UsageEvent",
    "LLMProvider",
    "LLMError",
    "ProviderError",
    "ProviderNotConfiguredError",
    "LLMGateway",
    "CircuitBreaker",
    "ModelRegistry",
    "MockProvider",
    "ROLE_SMART",
    "ROLE_FAST",
    "ROLE_VISION",
    "ROLE_EMBED",
    "get_gateway",
]


@lru_cache
def get_gateway() -> LLMGateway:
    """Build the process-wide gateway from configuration.

    Real provider adapters and the Prometheus/DB recorder are imported here
    (lazily) so this module stays importable without those dependencies.
    """
    from src.ai.llm.usage import PrometheusDBUsageRecorder
    from src.core.config import get_settings
    from src.core.database import SessionLocal

    settings = get_settings()
    providers: dict[str, LLMProvider] = {}

    if settings.OPENAI_API_KEY:
        from src.ai.llm.openai_provider import OpenAIProvider

        providers["openai"] = OpenAIProvider(
            settings.OPENAI_API_KEY, timeout=settings.LLM_REQUEST_TIMEOUT
        )
    if settings.ANTHROPIC_API_KEY:
        from src.ai.llm.anthropic_provider import AnthropicProvider

        providers["anthropic"] = AnthropicProvider(
            settings.ANTHROPIC_API_KEY, timeout=settings.LLM_REQUEST_TIMEOUT
        )
    if settings.GEMINI_API_KEY:
        from src.ai.llm.gemini_provider import GeminiProvider

        providers["gemini"] = GeminiProvider(
            settings.GEMINI_API_KEY, timeout=settings.LLM_REQUEST_TIMEOUT
        )

    recorder = PrometheusDBUsageRecorder(SessionLocal)

    if providers:
        return LLMGateway(
            ModelRegistry.from_settings(settings),
            providers,
            recorder=recorder,
            max_retries=settings.LLM_MAX_RETRIES,
        )

    if settings.AI_ALLOW_MOCK:
        return LLMGateway(
            ModelRegistry.all_mock(embed_model="mock-embed"),
            {"mock": MockProvider(embed_dim=settings.LLM_EMBED_DIM)},
            recorder=recorder,
            max_retries=settings.LLM_MAX_RETRIES,
        )

    raise ProviderNotConfiguredError(
        "No LLM provider configured. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or "
        "GEMINI_API_KEY — or set AI_ALLOW_MOCK=true for local development."
    )

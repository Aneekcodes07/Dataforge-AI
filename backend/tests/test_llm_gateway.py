"""LLM gateway tests — deterministic and network-free via the mock provider."""

from typing import Iterator, Sequence

import pytest

from src.ai.llm import (
    CircuitBreaker,
    LLMGateway,
    Message,
    MockProvider,
    ModelRegistry,
    ProviderNotConfiguredError,
    ROLE_SMART,
)
from src.ai.llm.anthropic_provider import AnthropicProvider
from src.ai.llm.base import (
    AuthenticationError,
    EmbeddingResponse,
    LLMProvider,
    LLMResponse,
    StreamChunk,
    TransientError,
    Usage,
    UsageEvent,
)
from src.ai.llm.gemini_provider import GeminiProvider
from src.ai.llm.openai_provider import OpenAIProvider
from src.ai.llm.pricing import compute_cost
from src.ai.llm.registry import ModelChoice, infer_provider


class CollectorRecorder:
    def __init__(self) -> None:
        self.events: list[UsageEvent] = []

    def record(self, event: UsageEvent) -> None:
        self.events.append(event)


class FlakyProvider(LLMProvider):
    """Raises TransientError for the first ``fail_times`` calls, then succeeds."""

    name = "mock"

    def __init__(self, fail_times: int) -> None:
        self.fail_times = fail_times
        self.calls = 0

    def complete(
        self, messages, *, model, temperature=0.2, max_tokens=None, response_format=None
    ):
        self.calls += 1
        if self.calls <= self.fail_times:
            raise TransientError("temporary", provider=self.name)
        return LLMResponse(
            text="ok", model=model, provider=self.name, usage=Usage(1, 1)
        )

    def stream(
        self, messages, *, model, temperature=0.2, max_tokens=None
    ) -> Iterator[StreamChunk]:
        yield StreamChunk(delta="ok", usage=Usage(1, 1))


class AlwaysFailProvider(LLMProvider):
    def __init__(self, name: str, exc: Exception) -> None:
        self.name = name
        self._exc = exc
        self.calls = 0

    def complete(
        self, messages, *, model, temperature=0.2, max_tokens=None, response_format=None
    ):
        self.calls += 1
        raise self._exc

    def stream(self, messages, *, model, temperature=0.2, max_tokens=None):
        raise self._exc
        yield  # pragma: no cover


def _msgs() -> Sequence[Message]:
    return [Message.system("You are helpful."), Message.user("hello world")]


def _mock_gateway(provider: LLMProvider, recorder=None, **kw) -> LLMGateway:
    return LLMGateway(
        ModelRegistry.all_mock(),
        {"mock": provider},
        recorder=recorder,
        sleep_fn=lambda _seconds: None,
        **kw,
    )


def test_complete_with_mock_records_usage():
    recorder = CollectorRecorder()
    gw = _mock_gateway(MockProvider(), recorder=recorder)
    resp = gw.complete(
        _msgs(), role=ROLE_SMART, feature="extraction", workspace_id="w1"
    )
    assert resp.provider == "mock"
    assert "hello world" in resp.text
    assert len(recorder.events) == 1
    ev = recorder.events[0]
    assert ev.status == "ok"
    assert ev.feature == "extraction"
    assert ev.total_tokens > 0


def test_retry_then_success():
    provider = FlakyProvider(fail_times=2)
    recorder = CollectorRecorder()
    gw = _mock_gateway(provider, recorder=recorder, max_retries=2)
    resp = gw.complete(_msgs())
    assert resp.text == "ok"
    assert provider.calls == 3  # 1 initial + 2 retries
    assert recorder.events[-1].status == "ok"


def test_retry_exhausted_then_fallback():
    primary = AlwaysFailProvider("openai", TransientError("down", provider="openai"))
    recorder = CollectorRecorder()
    gw = LLMGateway(
        ModelRegistry({ROLE_SMART: "gpt-4o"}),
        {"openai": primary, "mock": MockProvider()},
        recorder=recorder,
        max_retries=1,
        sleep_fn=lambda _s: None,
        fallback_chains={ROLE_SMART: [ModelChoice("mock", "mock-smart")]},
    )
    resp = gw.complete(_msgs())
    assert resp.provider == "mock"
    assert primary.calls == 2  # initial + 1 retry, all transient
    statuses = [e.status for e in recorder.events]
    assert "error" in statuses and "ok" in statuses


def test_non_transient_error_is_not_retried():
    provider = AlwaysFailProvider(
        "mock", AuthenticationError("bad key", provider="mock")
    )
    gw = _mock_gateway(provider, max_retries=3)
    with pytest.raises(AuthenticationError):
        gw.complete(_msgs())
    assert provider.calls == 1  # auth errors are not retried


def test_circuit_breaker_opens_after_threshold():
    provider = AlwaysFailProvider("mock", TransientError("boom", provider="mock"))
    breaker = CircuitBreaker(threshold=2, cooldown_seconds=999, time_fn=lambda: 0.0)
    gw = _mock_gateway(provider, max_retries=0, breaker=breaker)
    for _ in range(2):
        with pytest.raises(TransientError):
            gw.complete(_msgs())
    # Breaker now open: provider is skipped, raising a configuration error.
    with pytest.raises(ProviderNotConfiguredError):
        gw.complete(_msgs())
    assert provider.calls == 2


def test_embed_is_deterministic_and_unit_norm():
    gw = _mock_gateway(MockProvider(embed_dim=64))
    resp = gw.embed(["alpha", "beta"])
    assert isinstance(resp, EmbeddingResponse)
    assert len(resp.embeddings) == 2
    assert all(len(v) == 64 for v in resp.embeddings)
    again = gw.embed(["alpha"]).embeddings[0]
    assert again == resp.embeddings[0]  # deterministic
    norm = sum(x * x for x in resp.embeddings[0]) ** 0.5
    assert abs(norm - 1.0) < 1e-6


def test_stream_yields_text_and_records_usage():
    recorder = CollectorRecorder()
    gw = _mock_gateway(MockProvider(), recorder=recorder)
    chunks = list(gw.stream(_msgs(), feature="copilot"))
    text = "".join(c.delta for c in chunks)
    assert "hello world" in text
    assert len(recorder.events) == 1
    assert recorder.events[0].feature == "copilot"


def test_registry_infer_provider():
    assert infer_provider("gpt-4o") == "openai"
    assert infer_provider("text-embedding-3-small") == "openai"
    assert infer_provider("claude-3-5-sonnet-20241022") == "anthropic"
    assert infer_provider("gemini-1.5-pro") == "gemini"
    assert infer_provider("mock-smart") == "mock"
    with pytest.raises(ValueError):
        infer_provider("unknown-model")


def test_pricing_prefix_match():
    assert compute_cost("openai", "gpt-4o-mini", 1000, 1000) == pytest.approx(0.00075)
    assert compute_cost("openai", "gpt-4o-2024-08-06", 1000, 0) == pytest.approx(0.005)
    assert compute_cost("openai", "unpriced-model", 1000, 1000) == 0.0


def test_provider_adapters_construct_without_sdk():
    assert OpenAIProvider("k").name == "openai"
    assert AnthropicProvider("k").name == "anthropic"
    assert GeminiProvider("k").name == "gemini"
    # Anthropic has no embeddings: the base default rejects it without any SDK.
    with pytest.raises(ProviderNotConfiguredError):
        AnthropicProvider("k").embed(["x"], model="claude-3-5-sonnet")

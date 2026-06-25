"""LLMGateway — the single entry point for all model calls.

Adds, on top of raw providers:
  * role/model/provider resolution via the registry,
  * bounded retries with exponential backoff + jitter for transient errors,
  * a per-provider circuit breaker,
  * optional cross-provider fallback chains,
  * usage + cost capture via an injected recorder.

It imports only stdlib + local pure-Python modules, so it is fully unit-testable
with the mock provider and an in-memory recorder (no SDKs, prometheus, or DB).
"""

from __future__ import annotations

import logging
import random
import time
from typing import Callable, Iterator, Sequence, TypeVar

from src.ai.llm.base import (
    EmbeddingResponse,
    LLMProvider,
    LLMResponse,
    Message,
    NullUsageRecorder,
    ProviderError,
    ProviderNotConfiguredError,
    StreamChunk,
    TransientError,
    Usage,
    UsageEvent,
    UsageRecorder,
)
from src.ai.llm.pricing import compute_cost
from src.ai.llm.registry import ROLE_EMBED, ROLE_SMART, ModelChoice, ModelRegistry

logger = logging.getLogger(__name__)

T = TypeVar("T")


class CircuitBreaker:
    """Trips a provider open after consecutive failures for a cooldown window."""

    def __init__(
        self,
        threshold: int = 5,
        cooldown_seconds: float = 30.0,
        time_fn: Callable[[], float] = time.monotonic,
    ) -> None:
        self.threshold = threshold
        self.cooldown = cooldown_seconds
        self._time = time_fn
        self._failures: dict[str, int] = {}
        self._open_until: dict[str, float] = {}

    def is_open(self, provider: str) -> bool:
        until = self._open_until.get(provider)
        if until is None:
            return False
        if self._time() >= until:
            # Cooldown elapsed: half-open (allow a trial call).
            self._open_until.pop(provider, None)
            self._failures[provider] = 0
            return False
        return True

    def record_success(self, provider: str) -> None:
        self._failures[provider] = 0
        self._open_until.pop(provider, None)

    def record_failure(self, provider: str) -> None:
        count = self._failures.get(provider, 0) + 1
        self._failures[provider] = count
        if count >= self.threshold:
            self._open_until[provider] = self._time() + self.cooldown


class LLMGateway:
    def __init__(
        self,
        registry: ModelRegistry,
        providers: dict[str, LLMProvider],
        *,
        recorder: UsageRecorder | None = None,
        max_retries: int = 2,
        base_backoff: float = 0.5,
        max_backoff: float = 8.0,
        fallback_chains: dict[str, list[ModelChoice]] | None = None,
        breaker: CircuitBreaker | None = None,
        sleep_fn: Callable[[float], None] = time.sleep,
        time_fn: Callable[[], float] = time.monotonic,
    ) -> None:
        self._registry = registry
        self._providers = providers
        self._recorder = recorder or NullUsageRecorder()
        self._max_retries = max_retries
        self._base_backoff = base_backoff
        self._max_backoff = max_backoff
        self._fallbacks = fallback_chains or {}
        self._breaker = breaker or CircuitBreaker(time_fn=time_fn)
        self._sleep = sleep_fn
        self._time = time_fn

    # ----------------------------------------------------------------- #
    # Public API
    # ----------------------------------------------------------------- #

    def complete(
        self,
        messages: Sequence[Message],
        *,
        role: str = ROLE_SMART,
        model: str | None = None,
        provider: str | None = None,
        feature: str = "general",
        workspace_id: str | None = None,
        user_id: str | None = None,
        run_id: str | None = None,
        temperature: float = 0.2,
        max_tokens: int | None = None,
        response_format: str | None = None,
    ) -> LLMResponse:
        def call(p: LLMProvider, choice: ModelChoice) -> LLMResponse:
            return p.complete(
                messages,
                model=choice.model,
                temperature=temperature,
                max_tokens=max_tokens,
                response_format=response_format,
            )

        return self._run(
            self._chain(role, model, provider),
            call,
            feature=feature,
            workspace_id=workspace_id,
            user_id=user_id,
            run_id=run_id,
            usage_of=lambda r: r.usage,
        )

    def embed(
        self,
        inputs: Sequence[str],
        *,
        role: str = ROLE_EMBED,
        model: str | None = None,
        provider: str | None = None,
        feature: str = "embedding",
        workspace_id: str | None = None,
        user_id: str | None = None,
        run_id: str | None = None,
    ) -> EmbeddingResponse:
        def call(p: LLMProvider, choice: ModelChoice) -> EmbeddingResponse:
            return p.embed(list(inputs), model=choice.model)

        return self._run(
            self._chain(role, model, provider),
            call,
            feature=feature,
            workspace_id=workspace_id,
            user_id=user_id,
            run_id=run_id,
            usage_of=lambda r: r.usage,
        )

    def stream(
        self,
        messages: Sequence[Message],
        *,
        role: str = ROLE_SMART,
        model: str | None = None,
        provider: str | None = None,
        feature: str = "general",
        workspace_id: str | None = None,
        user_id: str | None = None,
        run_id: str | None = None,
        temperature: float = 0.2,
        max_tokens: int | None = None,
    ) -> Iterator[StreamChunk]:
        # Streaming uses the primary choice with retry on start (no mid-stream
        # fallback, since tokens may already have been emitted).
        choice = self._chain(role, model, provider)[0]
        prov = self._require(choice)
        started = self._time()

        def start() -> Iterator[StreamChunk]:
            return iter(
                prov.stream(
                    messages,
                    model=choice.model,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
            )

        try:
            iterator = self._retry(lambda: start(), choice.provider)
            first = next(iterator, None)
        except ProviderError as exc:
            self._breaker.record_failure(choice.provider)
            self._record_failure(
                choice, feature, workspace_id, user_id, run_id, started
            )
            raise exc

        self._breaker.record_success(choice.provider)
        final_usage = Usage()

        def generator() -> Iterator[StreamChunk]:
            nonlocal final_usage
            if first is not None:
                if first.usage:
                    final_usage = first.usage
                yield first
            for chunk in iterator:
                if chunk.usage:
                    final_usage = chunk.usage
                yield chunk
            self._record(
                choice,
                feature,
                workspace_id,
                user_id,
                run_id,
                started,
                final_usage,
                "ok",
            )

        return generator()

    # ----------------------------------------------------------------- #
    # Internals
    # ----------------------------------------------------------------- #

    def _chain(
        self, role: str, model: str | None, provider: str | None
    ) -> list[ModelChoice]:
        primary = self._registry.resolve(role, model=model, provider=provider)
        chain = [primary]
        if model is None and provider is None:
            for choice in self._fallbacks.get(role, []):
                if choice not in chain:
                    chain.append(choice)
        return chain

    def _require(self, choice: ModelChoice) -> LLMProvider:
        prov = self._providers.get(choice.provider)
        if prov is None:
            raise ProviderNotConfiguredError(
                f"No provider '{choice.provider}' configured for model '{choice.model}'"
            )
        return prov

    def _run(
        self,
        chain: list[ModelChoice],
        call: Callable[[LLMProvider, ModelChoice], T],
        *,
        feature: str,
        workspace_id: str | None,
        user_id: str | None,
        run_id: str | None,
        usage_of: Callable[[T], Usage],
    ) -> T:
        last_error: Exception | None = None
        attempted = False
        for choice in chain:
            prov = self._providers.get(choice.provider)
            if prov is None:
                last_error = ProviderNotConfiguredError(
                    f"No provider '{choice.provider}' configured"
                )
                continue
            if self._breaker.is_open(choice.provider):
                logger.warning(
                    "Circuit open for provider '%s'; skipping", choice.provider
                )
                continue
            attempted = True
            started = self._time()
            try:
                result = self._retry(lambda: call(prov, choice), choice.provider)
            except ProviderError as exc:
                last_error = exc
                self._breaker.record_failure(choice.provider)
                self._record_failure(
                    choice, feature, workspace_id, user_id, run_id, started
                )
                logger.warning(
                    "Provider '%s' failed for feature '%s': %s",
                    choice.provider,
                    feature,
                    exc,
                )
                continue
            self._breaker.record_success(choice.provider)
            self._record(
                choice,
                feature,
                workspace_id,
                user_id,
                run_id,
                started,
                usage_of(result),
                "ok",
            )
            return result

        if last_error is not None:
            raise last_error
        if not attempted:
            raise ProviderNotConfiguredError(
                "No usable LLM provider is configured for this request"
            )
        raise ProviderNotConfiguredError("All providers failed")

    def _retry(self, fn: Callable[[], T], provider: str) -> T:
        attempt = 0
        while True:
            try:
                return fn()
            except TransientError as exc:
                if attempt >= self._max_retries:
                    raise
                delay = min(
                    self._base_backoff * (2**attempt), self._max_backoff
                ) + random.uniform(0, self._base_backoff)
                logger.info(
                    "Transient error from '%s' (attempt %d): %s; retrying in %.2fs",
                    provider,
                    attempt + 1,
                    exc,
                    delay,
                )
                self._sleep(delay)
                attempt += 1

    def _record(
        self,
        choice: ModelChoice,
        feature: str,
        workspace_id: str | None,
        user_id: str | None,
        run_id: str | None,
        started: float,
        usage: Usage,
        status: str,
    ) -> None:
        cost = compute_cost(
            choice.provider, choice.model, usage.prompt_tokens, usage.completion_tokens
        )
        self._recorder.record(
            UsageEvent(
                feature=feature,
                provider=choice.provider,
                model=choice.model,
                prompt_tokens=usage.prompt_tokens,
                completion_tokens=usage.completion_tokens,
                total_tokens=usage.total_tokens,
                cost_usd=cost,
                latency_ms=int((self._time() - started) * 1000),
                status=status,
                workspace_id=workspace_id,
                user_id=user_id,
                run_id=run_id,
            )
        )

    def _record_failure(
        self,
        choice: ModelChoice,
        feature: str,
        workspace_id: str | None,
        user_id: str | None,
        run_id: str | None,
        started: float,
    ) -> None:
        self._record(
            choice,
            feature,
            workspace_id,
            user_id,
            run_id,
            started,
            Usage(),
            "error",
        )

"""Anthropic provider adapter (anthropic>=0.18). SDK imported lazily.

Anthropic has no embeddings API, so :meth:`embed` raises
ProviderNotConfiguredError and embeddings should be routed to another provider.
"""

from __future__ import annotations

from typing import Iterator, Sequence

from src.ai.llm.base import (
    AuthenticationError,
    BadRequestError,
    LLMProvider,
    LLMResponse,
    Message,
    ProviderError,
    ProviderNotConfiguredError,
    RateLimitError,
    StreamChunk,
    TransientError,
    Usage,
)

_DEFAULT_MAX_TOKENS = 4096


class AnthropicProvider(LLMProvider):
    name = "anthropic"

    def __init__(self, api_key: str, *, timeout: float = 60.0) -> None:
        self._api_key = api_key
        self._timeout = timeout
        self._client = None

    def _get_client(self):
        if self._client is None:
            try:
                import anthropic
            except ImportError as exc:  # pragma: no cover - environment guard
                raise ProviderNotConfiguredError(
                    "The 'anthropic' package is not installed"
                ) from exc
            self._client = anthropic.Anthropic(
                api_key=self._api_key, timeout=self._timeout
            )
        return self._client

    def _map_error(self, exc: Exception) -> ProviderError:
        try:
            import anthropic
        except ImportError:  # pragma: no cover
            return ProviderError(str(exc), provider=self.name)
        if isinstance(exc, anthropic.RateLimitError):
            return RateLimitError(str(exc), provider=self.name)
        if isinstance(
            exc,
            (
                anthropic.APITimeoutError,
                anthropic.APIConnectionError,
                anthropic.InternalServerError,
            ),
        ):
            return TransientError(str(exc), provider=self.name)
        if isinstance(exc, anthropic.AuthenticationError):
            return AuthenticationError(str(exc), provider=self.name)
        if isinstance(exc, anthropic.BadRequestError):
            return BadRequestError(str(exc), provider=self.name)
        return ProviderError(str(exc), provider=self.name)

    @staticmethod
    def _split(messages: Sequence[Message]) -> tuple[str, list[dict]]:
        system = "\n".join(m.content for m in messages if m.role == "system")
        turns = [
            {"role": m.role, "content": m.content}
            for m in messages
            if m.role in ("user", "assistant")
        ]
        return system, turns

    def complete(
        self,
        messages: Sequence[Message],
        *,
        model: str,
        temperature: float = 0.2,
        max_tokens: int | None = None,
        response_format: str | None = None,
    ) -> LLMResponse:
        client = self._get_client()
        system, turns = self._split(messages)
        if response_format == "json":
            system = (system + "\nRespond with valid JSON only.").strip()
        try:
            resp = client.messages.create(
                model=model,
                system=system or None,
                messages=turns,
                temperature=temperature,
                max_tokens=max_tokens or _DEFAULT_MAX_TOKENS,
            )
        except Exception as exc:  # noqa: BLE001
            raise self._map_error(exc) from exc

        text = "".join(
            block.text for block in resp.content if getattr(block, "type", "") == "text"
        )
        usage = Usage(
            prompt_tokens=getattr(resp.usage, "input_tokens", 0) or 0,
            completion_tokens=getattr(resp.usage, "output_tokens", 0) or 0,
        )
        return LLMResponse(
            text=text,
            model=model,
            provider=self.name,
            usage=usage,
            finish_reason=getattr(resp, "stop_reason", None),
        )

    def stream(
        self,
        messages: Sequence[Message],
        *,
        model: str,
        temperature: float = 0.2,
        max_tokens: int | None = None,
    ) -> Iterator[StreamChunk]:
        client = self._get_client()
        system, turns = self._split(messages)
        try:
            with client.messages.stream(
                model=model,
                system=system or None,
                messages=turns,
                temperature=temperature,
                max_tokens=max_tokens or _DEFAULT_MAX_TOKENS,
            ) as stream:
                for text in stream.text_stream:
                    if text:
                        yield StreamChunk(delta=text)
                final = stream.get_final_message()
                yield StreamChunk(
                    delta="",
                    usage=Usage(
                        prompt_tokens=getattr(final.usage, "input_tokens", 0) or 0,
                        completion_tokens=getattr(final.usage, "output_tokens", 0) or 0,
                    ),
                    finish_reason=getattr(final, "stop_reason", None),
                )
        except Exception as exc:  # noqa: BLE001
            raise self._map_error(exc) from exc

"""OpenAI provider adapter (openai>=1.0). SDK imported lazily."""

from __future__ import annotations

import base64
from typing import Iterator, Sequence

from src.ai.llm.base import (
    AuthenticationError,
    BadRequestError,
    EmbeddingResponse,
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


class OpenAIProvider(LLMProvider):
    name = "openai"

    def __init__(self, api_key: str, *, timeout: float = 60.0) -> None:
        self._api_key = api_key
        self._timeout = timeout
        self._client = None

    def _get_client(self):
        if self._client is None:
            try:
                from openai import OpenAI
            except ImportError as exc:  # pragma: no cover - environment guard
                raise ProviderNotConfiguredError(
                    "The 'openai' package is not installed"
                ) from exc
            self._client = OpenAI(api_key=self._api_key, timeout=self._timeout)
        return self._client

    def _map_error(self, exc: Exception) -> ProviderError:
        try:
            import openai
        except ImportError:  # pragma: no cover
            return ProviderError(str(exc), provider=self.name)
        if isinstance(exc, openai.RateLimitError):
            return RateLimitError(str(exc), provider=self.name)
        if isinstance(
            exc,
            (
                openai.APITimeoutError,
                openai.APIConnectionError,
                openai.InternalServerError,
            ),
        ):
            return TransientError(str(exc), provider=self.name)
        if isinstance(exc, openai.AuthenticationError):
            return AuthenticationError(str(exc), provider=self.name)
        if isinstance(exc, openai.BadRequestError):
            return BadRequestError(str(exc), provider=self.name)
        return ProviderError(str(exc), provider=self.name)

    @staticmethod
    def _to_messages(messages: Sequence[Message]) -> list[dict]:
        return [{"role": m.role, "content": m.content} for m in messages]

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
        kwargs: dict = {
            "model": model,
            "messages": self._to_messages(messages),
            "temperature": temperature,
        }
        if max_tokens:
            kwargs["max_tokens"] = max_tokens
        if response_format == "json":
            kwargs["response_format"] = {"type": "json_object"}
        try:
            resp = client.chat.completions.create(**kwargs)
        except Exception as exc:  # noqa: BLE001 - normalized below
            raise self._map_error(exc) from exc

        choice = resp.choices[0]
        usage = Usage(
            prompt_tokens=getattr(resp.usage, "prompt_tokens", 0) or 0,
            completion_tokens=getattr(resp.usage, "completion_tokens", 0) or 0,
        )
        return LLMResponse(
            text=choice.message.content or "",
            model=model,
            provider=self.name,
            usage=usage,
            finish_reason=choice.finish_reason,
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
        kwargs: dict = {
            "model": model,
            "messages": self._to_messages(messages),
            "temperature": temperature,
            "stream": True,
            "stream_options": {"include_usage": True},
        }
        if max_tokens:
            kwargs["max_tokens"] = max_tokens
        try:
            stream = client.chat.completions.create(**kwargs)
            for event in stream:
                usage = None
                if getattr(event, "usage", None):
                    usage = Usage(
                        prompt_tokens=event.usage.prompt_tokens or 0,
                        completion_tokens=event.usage.completion_tokens or 0,
                    )
                delta = ""
                finish = None
                if event.choices:
                    delta = event.choices[0].delta.content or ""
                    finish = event.choices[0].finish_reason
                if delta or usage or finish:
                    yield StreamChunk(delta=delta, usage=usage, finish_reason=finish)
        except Exception as exc:  # noqa: BLE001
            raise self._map_error(exc) from exc

    def embed(self, inputs: Sequence[str], *, model: str) -> EmbeddingResponse:
        client = self._get_client()
        try:
            resp = client.embeddings.create(model=model, input=list(inputs))
        except Exception as exc:  # noqa: BLE001
            raise self._map_error(exc) from exc
        embeddings = [item.embedding for item in resp.data]
        usage = Usage(prompt_tokens=getattr(resp.usage, "prompt_tokens", 0) or 0)
        return EmbeddingResponse(
            embeddings=embeddings, model=model, provider=self.name, usage=usage
        )

    def vision(
        self,
        messages: Sequence[Message],
        images: Sequence[bytes],
        *,
        model: str,
        temperature: float = 0.2,
        max_tokens: int | None = None,
    ) -> LLMResponse:
        client = self._get_client()
        content: list[dict] = []
        text = "\n".join(m.content for m in messages if m.role != "system")
        content.append({"type": "text", "text": text})
        for image in images:
            b64 = base64.b64encode(image).decode("ascii")
            content.append(
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/png;base64,{b64}"},
                }
            )
        api_messages: list[dict] = [
            {"role": m.role, "content": m.content}
            for m in messages
            if m.role == "system"
        ]
        api_messages.append({"role": "user", "content": content})
        kwargs: dict = {
            "model": model,
            "messages": api_messages,
            "temperature": temperature,
        }
        if max_tokens:
            kwargs["max_tokens"] = max_tokens
        try:
            resp = client.chat.completions.create(**kwargs)
        except Exception as exc:  # noqa: BLE001
            raise self._map_error(exc) from exc
        choice = resp.choices[0]
        usage = Usage(
            prompt_tokens=getattr(resp.usage, "prompt_tokens", 0) or 0,
            completion_tokens=getattr(resp.usage, "completion_tokens", 0) or 0,
        )
        return LLMResponse(
            text=choice.message.content or "",
            model=model,
            provider=self.name,
            usage=usage,
            finish_reason=choice.finish_reason,
        )

"""Google Gemini provider adapter (google-generativeai). SDK imported lazily."""

from __future__ import annotations

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


class GeminiProvider(LLMProvider):
    name = "gemini"

    def __init__(self, api_key: str, *, timeout: float = 60.0) -> None:
        self._api_key = api_key
        self._timeout = timeout
        self._configured = False

    def _genai(self):
        try:
            import google.generativeai as genai
        except ImportError as exc:  # pragma: no cover - environment guard
            raise ProviderNotConfiguredError(
                "The 'google-generativeai' package is not installed"
            ) from exc
        if not self._configured:
            genai.configure(api_key=self._api_key)
            self._configured = True
        return genai

    def _map_error(self, exc: Exception) -> ProviderError:
        try:
            from google.api_core import exceptions as gexc
        except ImportError:  # pragma: no cover
            return ProviderError(str(exc), provider=self.name)
        if isinstance(exc, gexc.ResourceExhausted):
            return RateLimitError(str(exc), provider=self.name)
        if isinstance(
            exc,
            (gexc.ServiceUnavailable, gexc.InternalServerError, gexc.DeadlineExceeded),
        ):
            return TransientError(str(exc), provider=self.name)
        if isinstance(exc, (gexc.Unauthenticated, gexc.PermissionDenied)):
            return AuthenticationError(str(exc), provider=self.name)
        if isinstance(exc, gexc.InvalidArgument):
            return BadRequestError(str(exc), provider=self.name)
        return ProviderError(str(exc), provider=self.name)

    @staticmethod
    def _split(messages: Sequence[Message]) -> tuple[str, list[dict]]:
        system = "\n".join(m.content for m in messages if m.role == "system")
        contents = []
        for m in messages:
            if m.role == "system":
                continue
            role = "model" if m.role == "assistant" else "user"
            contents.append({"role": role, "parts": [m.content]})
        return system, contents

    def complete(
        self,
        messages: Sequence[Message],
        *,
        model: str,
        temperature: float = 0.2,
        max_tokens: int | None = None,
        response_format: str | None = None,
    ) -> LLMResponse:
        genai = self._genai()
        system, contents = self._split(messages)
        gen_config: dict = {"temperature": temperature}
        if max_tokens:
            gen_config["max_output_tokens"] = max_tokens
        if response_format == "json":
            gen_config["response_mime_type"] = "application/json"
        try:
            gen_model = genai.GenerativeModel(model, system_instruction=system or None)
            resp = gen_model.generate_content(contents, generation_config=gen_config)
        except Exception as exc:  # noqa: BLE001
            raise self._map_error(exc) from exc

        meta = getattr(resp, "usage_metadata", None)
        usage = Usage(
            prompt_tokens=getattr(meta, "prompt_token_count", 0) or 0,
            completion_tokens=getattr(meta, "candidates_token_count", 0) or 0,
        )
        return LLMResponse(
            text=resp.text or "",
            model=model,
            provider=self.name,
            usage=usage,
        )

    def stream(
        self,
        messages: Sequence[Message],
        *,
        model: str,
        temperature: float = 0.2,
        max_tokens: int | None = None,
    ) -> Iterator[StreamChunk]:
        genai = self._genai()
        system, contents = self._split(messages)
        gen_config: dict = {"temperature": temperature}
        if max_tokens:
            gen_config["max_output_tokens"] = max_tokens
        try:
            gen_model = genai.GenerativeModel(model, system_instruction=system or None)
            resp = gen_model.generate_content(
                contents, generation_config=gen_config, stream=True
            )
            final_meta = None
            for event in resp:
                if getattr(event, "text", None):
                    yield StreamChunk(delta=event.text)
                final_meta = getattr(event, "usage_metadata", None) or final_meta
            yield StreamChunk(
                delta="",
                usage=Usage(
                    prompt_tokens=getattr(final_meta, "prompt_token_count", 0) or 0,
                    completion_tokens=getattr(final_meta, "candidates_token_count", 0)
                    or 0,
                ),
            )
        except Exception as exc:  # noqa: BLE001
            raise self._map_error(exc) from exc

    def embed(self, inputs: Sequence[str], *, model: str) -> EmbeddingResponse:
        genai = self._genai()
        try:
            embeddings: list[list[float]] = []
            for text in inputs:
                result = genai.embed_content(model=model, content=text)
                embeddings.append(result["embedding"])
        except Exception as exc:  # noqa: BLE001
            raise self._map_error(exc) from exc
        return EmbeddingResponse(
            embeddings=embeddings, model=model, provider=self.name, usage=Usage()
        )

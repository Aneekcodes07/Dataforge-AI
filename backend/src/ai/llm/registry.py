"""Model registry — maps logical roles to concrete provider+model pairs.

Roles decouple call sites from specific models: code asks for the ``smart`` or
``embed`` model and the registry resolves it from configuration. The owning
provider is inferred from the model name so a single setting controls both.
"""

from __future__ import annotations

from dataclasses import dataclass

# Logical roles used across the platform.
ROLE_SMART = "smart"
ROLE_FAST = "fast"
ROLE_VISION = "vision"
ROLE_EMBED = "embed"


def infer_provider(model: str) -> str:
    """Infer the provider that owns a model from its name."""
    name = model.lower()
    if name.startswith("mock"):
        return "mock"
    if name.startswith(("gpt-", "o1", "o3", "text-embedding-")):
        return "openai"
    if name.startswith("claude"):
        return "anthropic"
    if name.startswith(("gemini", "models/gemini", "text-embedding-004")):
        return "gemini"
    raise ValueError(f"Cannot infer provider for model '{model}'")


@dataclass(frozen=True)
class ModelChoice:
    provider: str
    model: str


class ModelRegistry:
    """Resolves a role (and optional overrides) to a concrete model choice."""

    def __init__(self, roles: dict[str, str]) -> None:
        # roles maps role name -> model name
        self._roles = dict(roles)

    def resolve(
        self,
        role: str = ROLE_SMART,
        *,
        model: str | None = None,
        provider: str | None = None,
    ) -> ModelChoice:
        chosen_model = model or self._roles.get(role)
        if not chosen_model:
            raise ValueError(f"No model configured for role '{role}'")
        chosen_provider = provider or infer_provider(chosen_model)
        return ModelChoice(provider=chosen_provider, model=chosen_model)

    @property
    def roles(self) -> dict[str, str]:
        return dict(self._roles)

    @classmethod
    def from_settings(cls, settings) -> "ModelRegistry":
        return cls(
            {
                ROLE_SMART: settings.LLM_SMART_MODEL,
                ROLE_FAST: settings.LLM_FAST_MODEL,
                ROLE_VISION: settings.LLM_VISION_MODEL,
                ROLE_EMBED: settings.LLM_EMBED_MODEL,
            }
        )

    @classmethod
    def all_mock(cls, *, embed_model: str = "mock-embed") -> "ModelRegistry":
        """A registry whose roles all map to mock model names (for dev/tests)."""
        return cls(
            {
                ROLE_SMART: "mock-smart",
                ROLE_FAST: "mock-fast",
                ROLE_VISION: "mock-vision",
                ROLE_EMBED: embed_model,
            }
        )

"""Token pricing and cost computation (USD per 1K tokens).

Prices are approximate public list prices and live in one place so cost tracking
stays maintainable. Unknown models cost 0.0 (logged by the recorder) rather than
breaking the call path. Model names are matched by longest known prefix so dated
variants (e.g. ``gpt-4o-2024-08-06``) resolve to their family price.
"""

from __future__ import annotations

# (provider, model_prefix) -> (input_per_1k, output_per_1k)
PRICING: dict[tuple[str, str], tuple[float, float]] = {
    ("openai", "gpt-4o-mini"): (0.00015, 0.0006),
    ("openai", "gpt-4o"): (0.005, 0.015),
    ("openai", "text-embedding-3-small"): (0.00002, 0.0),
    ("openai", "text-embedding-3-large"): (0.00013, 0.0),
    ("anthropic", "claude-3-5-sonnet"): (0.003, 0.015),
    ("anthropic", "claude-3-5-haiku"): (0.0008, 0.004),
    ("anthropic", "claude-3-opus"): (0.015, 0.075),
    ("gemini", "gemini-1.5-pro"): (0.00125, 0.005),
    ("gemini", "gemini-1.5-flash"): (0.000075, 0.0003),
    ("gemini", "text-embedding-004"): (0.0, 0.0),
}


def _rates_for(provider: str, model: str) -> tuple[float, float] | None:
    candidates = [
        (prefix, rates)
        for (prov, prefix), rates in PRICING.items()
        if prov == provider and model.startswith(prefix)
    ]
    if not candidates:
        return None
    # Prefer the most specific (longest) matching prefix.
    candidates.sort(key=lambda item: len(item[0]), reverse=True)
    return candidates[0][1]


def compute_cost(
    provider: str, model: str, prompt_tokens: int, completion_tokens: int
) -> float:
    """Return the cost in USD for a call, or 0.0 if the model is unpriced."""
    rates = _rates_for(provider, model)
    if rates is None:
        return 0.0
    input_rate, output_rate = rates
    return round(
        (prompt_tokens / 1000.0) * input_rate
        + (completion_tokens / 1000.0) * output_rate,
        6,
    )

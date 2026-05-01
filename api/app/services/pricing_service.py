from __future__ import annotations

from typing import Any

from app.core.billing_rules import default_usd_price_table, normalize_billing_rules
from app.schemas.generation import QualityLiteral, SizeLiteral

USD_PRICE_TABLE: dict[tuple[str, str], float] = {
    (size, quality): price
    for size, quality_prices in default_usd_price_table().items()
    for quality, price in quality_prices.items()
}


def _generated_usd_price(size: str, quality: str, rules: dict[str, Any]) -> float:
    if size == "auto":
        return float(rules["usd_price_table"]["1024x1024"][quality])

    try:
        width_text, height_text = size.split("x", 1)
        pixels = int(width_text) * int(height_text)
    except (ValueError, AttributeError):
        return float(rules["usd_price_table"]["1024x1024"][quality])

    quality_multiplier = {"low": 0.5, "medium": 1.0, "high": 1.5}[quality]
    base_pixels = 1024 * 1024
    base_price = float(rules["usd_price_table"]["1024x1024"]["medium"])
    return max(0.01, round(base_price * (pixels / base_pixels) * quality_multiplier, 4))


def estimate_usd_price(size: SizeLiteral, quality: QualityLiteral, rules: dict[str, Any] | None = None) -> float:
    billing_rules = normalize_billing_rules(rules)
    quality_prices = billing_rules["usd_price_table"].get(size)
    if isinstance(quality_prices, dict) and quality in quality_prices:
        return float(quality_prices[quality])
    return _generated_usd_price(size, quality, billing_rules)


def points_from_usd(cost_usd: float, rules: dict[str, Any] | None = None) -> int:
    billing_rules = normalize_billing_rules(rules)
    return int(round(cost_usd * float(billing_rules["billing_cost_multiplier"]) * 100))


def calculate_usage_cost_usd(
    *,
    input_text_tokens: int,
    input_image_tokens: int,
    output_text_tokens: int,
    output_image_tokens: int,
    rules: dict[str, Any] | None = None,
) -> float:
    billing_rules = normalize_billing_rules(rules)
    token_prices = billing_rules["openai_token_prices_usd_per_1m"]
    per_million = 1_000_000
    input_text_cost = input_text_tokens * token_prices["input_text"] / per_million
    input_image_cost = input_image_tokens * token_prices["input_image"] / per_million
    output_text_cost = output_text_tokens * token_prices["output_text"] / per_million
    output_image_cost = output_image_tokens * token_prices["output_image"] / per_million
    return input_text_cost + input_image_cost + output_text_cost + output_image_cost


def calculate_price(size: SizeLiteral, quality: QualityLiteral, rules: dict[str, Any] | None = None) -> int:
    return points_from_usd(estimate_usd_price(size, quality, rules), rules)

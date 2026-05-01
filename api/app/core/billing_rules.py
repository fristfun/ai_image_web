from __future__ import annotations

import json
from typing import Any

from app.core.config import settings
from app.core.image_sizes import DEFAULT_IMAGE_SIZE_OPTIONS


BILLING_RULES_KEY = "billing_rules"
QUALITIES = ("low", "medium", "high")

BASE_USD_PRICE_TABLE: dict[str, dict[str, float]] = {
    "256x256": {"low": 0.01, "medium": 0.01, "high": 0.02},
    "512x512": {"low": 0.03, "medium": 0.05, "high": 0.08},
    "1024x1024": {"low": 0.10, "medium": 0.20, "high": 0.30},
    "1024x1536": {"low": 0.15, "medium": 0.25, "high": 0.35},
    "1024x1792": {"low": 0.18, "medium": 0.30, "high": 0.42},
    "1536x1024": {"low": 0.15, "medium": 0.25, "high": 0.35},
    "1792x1024": {"low": 0.18, "medium": 0.30, "high": 0.42},
}


def _generated_price(size: str, quality: str) -> float:
    if size == "auto":
        return BASE_USD_PRICE_TABLE["1024x1024"][quality]
    try:
        width_text, height_text = size.split("x", 1)
        pixels = int(width_text) * int(height_text)
    except (ValueError, AttributeError):
        return BASE_USD_PRICE_TABLE["1024x1024"][quality]

    quality_multiplier = {"low": 0.5, "medium": 1.0, "high": 1.5}[quality]
    base_pixels = 1024 * 1024
    base_price = BASE_USD_PRICE_TABLE["1024x1024"]["medium"]
    return max(0.01, round(base_price * (pixels / base_pixels) * quality_multiplier, 4))


def default_usd_price_table() -> dict[str, dict[str, float]]:
    table = {size: prices.copy() for size, prices in BASE_USD_PRICE_TABLE.items()}
    for option in DEFAULT_IMAGE_SIZE_OPTIONS:
        size = option["value"]
        table.setdefault(size, {quality: _generated_price(size, quality) for quality in QUALITIES})
    return table


def default_billing_rules() -> dict[str, Any]:
    return {
        "billing_cost_multiplier": settings.billing_cost_multiplier,
        "usd_price_table": default_usd_price_table(),
        "openai_token_prices_usd_per_1m": {
            "input_text": settings.openai_image_input_text_usd_per_1m,
            "input_image": settings.openai_image_input_image_usd_per_1m,
            "output_text": settings.openai_image_output_text_usd_per_1m,
            "output_image": settings.openai_image_output_image_usd_per_1m,
        },
    }


def _positive_float(value: Any, fallback: float) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return fallback
    return parsed if parsed >= 0 else fallback


def normalize_billing_rules(raw_rules: Any) -> dict[str, Any]:
    defaults = default_billing_rules()
    if not isinstance(raw_rules, dict):
        return defaults

    multiplier = _positive_float(raw_rules.get("billing_cost_multiplier"), defaults["billing_cost_multiplier"])

    price_table = defaults["usd_price_table"].copy()
    raw_price_table = raw_rules.get("usd_price_table")
    if isinstance(raw_price_table, dict):
        for size, quality_prices in raw_price_table.items():
            if not isinstance(quality_prices, dict):
                continue
            size_key = str(size).strip()
            if not size_key:
                continue
            current = price_table.get(size_key, {})
            price_table[size_key] = {
                quality: _positive_float(quality_prices.get(quality), current.get(quality, _generated_price(size_key, quality)))
                for quality in QUALITIES
            }

    token_defaults = defaults["openai_token_prices_usd_per_1m"]
    raw_token_prices = raw_rules.get("openai_token_prices_usd_per_1m")
    token_prices = token_defaults.copy()
    if isinstance(raw_token_prices, dict):
        for key in token_prices:
            token_prices[key] = _positive_float(raw_token_prices.get(key), token_prices[key])

    return {
        "billing_cost_multiplier": multiplier,
        "usd_price_table": price_table,
        "openai_token_prices_usd_per_1m": token_prices,
    }


def parse_billing_rules(setting_value: str | None) -> dict[str, Any]:
    if not setting_value:
        return default_billing_rules()
    try:
        return normalize_billing_rules(json.loads(setting_value))
    except json.JSONDecodeError:
        return default_billing_rules()


def serialize_billing_rules(raw_rules: Any) -> str:
    return json.dumps(normalize_billing_rules(raw_rules), ensure_ascii=False)

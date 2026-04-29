from __future__ import annotations

from app.core.config import settings
from app.schemas.generation import QualityLiteral, SizeLiteral

USD_PRICE_TABLE: dict[tuple[str, str], float] = {
    ("256x256", "low"): 0.01,
    ("256x256", "medium"): 0.01,
    ("256x256", "high"): 0.02,
    ("512x512", "low"): 0.03,
    ("512x512", "medium"): 0.05,
    ("512x512", "high"): 0.08,
    ("1024x1024", "low"): 0.10,
    ("1024x1024", "medium"): 0.20,
    ("1024x1024", "high"): 0.30,
    ("1024x1536", "low"): 0.15,
    ("1024x1536", "medium"): 0.25,
    ("1024x1536", "high"): 0.35,
    ("1024x1792", "low"): 0.18,
    ("1024x1792", "medium"): 0.30,
    ("1024x1792", "high"): 0.42,
    ("1536x1024", "low"): 0.15,
    ("1536x1024", "medium"): 0.25,
    ("1536x1024", "high"): 0.35,
    ("1792x1024", "low"): 0.18,
    ("1792x1024", "medium"): 0.30,
    ("1792x1024", "high"): 0.42,
}


def estimate_usd_price(size: SizeLiteral, quality: QualityLiteral) -> float:
    return USD_PRICE_TABLE[(size, quality)]


def points_from_usd(cost_usd: float) -> int:
    # 积分规则：真实 API 费用 * 系数，再按 1 USD = 100 points 换算为整数积分
    return int(round(cost_usd * settings.billing_cost_multiplier * 100))


def calculate_usage_cost_usd(
    *,
    input_text_tokens: int,
    input_image_tokens: int,
    output_text_tokens: int,
    output_image_tokens: int,
) -> float:
    per_million = 1_000_000
    input_text_cost = input_text_tokens * settings.openai_image_input_text_usd_per_1m / per_million
    input_image_cost = input_image_tokens * settings.openai_image_input_image_usd_per_1m / per_million
    output_text_cost = output_text_tokens * settings.openai_image_output_text_usd_per_1m / per_million
    output_image_cost = output_image_tokens * settings.openai_image_output_image_usd_per_1m / per_million
    return input_text_cost + input_image_cost + output_text_cost + output_image_cost


def calculate_price(size: SizeLiteral, quality: QualityLiteral) -> int:
    return points_from_usd(estimate_usd_price(size, quality))

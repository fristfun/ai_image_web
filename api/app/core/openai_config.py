from __future__ import annotations

from app.core.config import settings


OPENAI_API_KEY_SETTING_KEY = "openai_api_key"


def resolve_openai_api_key(configured_key: str | None) -> str:
    api_key = (configured_key or "").strip()
    return api_key or settings.openai_api_key


def mask_api_key(api_key: str | None) -> str:
    value = (api_key or "").strip()
    if not value:
        return ""
    if len(value) <= 12:
        return f"{value[:3]}***{value[-2:]}"
    return f"{value[:7]}...{value[-4:]}"

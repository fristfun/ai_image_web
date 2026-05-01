from __future__ import annotations

import json
import re
from typing import Any


IMAGE_SIZE_OPTIONS_KEY = "image_size_options"

DEFAULT_IMAGE_SIZE_OPTIONS: list[dict[str, str]] = [
    {"value": "auto", "label": "auto（自动适应）"},
    {"value": "1024x1024", "label": "1024x1024（小红书方图）"},
    {"value": "1024x1536", "label": "1024x1536（小红书竖图）"},
    {"value": "1536x1024", "label": "1536x1024（横版海报）"},
    {"value": "2048x2048", "label": "2048x2048（高清方图）"},
    {"value": "2048x1152", "label": "2048x1152（高清横图 / 16:9横图）"},
    {"value": "2160x3840", "label": "2160x3840（4K竖图 / 抖音竖屏）"},
    {"value": "3840x2160", "label": "3840x2160（4K横图 / 16:9横屏）"},
    {"value": "1088x1920", "label": "1088x1920（标准9:16竖图）"},
    {"value": "1920x1088", "label": "1920x1088（标准16:9横图）"},
    {"value": "1440x1440", "label": "1440x1440（高清方图）"},
    {"value": "1280x1920", "label": "1280x1920（竖版海报）"},
    {"value": "1920x1280", "label": "1920x1280（横版宣传图）"},
]

SIZE_PATTERN = re.compile(r"^\d{2,5}x\d{2,5}$")


def normalize_image_size_options(raw_options: Any) -> list[dict[str, str]]:
    if not isinstance(raw_options, list):
        return DEFAULT_IMAGE_SIZE_OPTIONS

    options: list[dict[str, str]] = []
    seen: set[str] = set()
    for item in raw_options:
        if not isinstance(item, dict):
            continue
        value = str(item.get("value", "")).strip()
        label = str(item.get("label", "")).strip()
        if not value or value in seen:
            continue
        if value != "auto" and not SIZE_PATTERN.match(value):
            continue
        options.append({"value": value, "label": label or value})
        seen.add(value)

    return options or DEFAULT_IMAGE_SIZE_OPTIONS


def parse_image_size_options(setting_value: str | None) -> list[dict[str, str]]:
    if not setting_value:
        return DEFAULT_IMAGE_SIZE_OPTIONS
    try:
        return normalize_image_size_options(json.loads(setting_value))
    except json.JSONDecodeError:
        return DEFAULT_IMAGE_SIZE_OPTIONS


def serialize_image_size_options(options: Any) -> str:
    return json.dumps(normalize_image_size_options(options), ensure_ascii=False)


def allowed_image_size_values(setting_value: str | None) -> set[str]:
    return {item["value"] for item in parse_image_size_options(setting_value)}

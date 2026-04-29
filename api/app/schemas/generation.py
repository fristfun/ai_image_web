from typing import Literal

from pydantic import BaseModel, Field


SizeLiteral = Literal["256x256", "512x512", "1024x1024", "1024x1536", "1536x1024", "1024x1792", "1792x1024"]
QualityLiteral = Literal["low", "medium", "high"]
FormatLiteral = Literal["webp", "png", "jpeg"]


class GenerationRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=4000)
    size: SizeLiteral
    quality: QualityLiteral
    output_format: FormatLiteral = Field(alias="format")

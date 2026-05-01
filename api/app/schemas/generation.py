from typing import Literal

from pydantic import BaseModel, Field


SizeLiteral = str
QualityLiteral = Literal["low", "medium", "high"]
FormatLiteral = Literal["webp", "png", "jpeg"]


class GenerationRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=4000)
    size: SizeLiteral
    quality: QualityLiteral
    output_format: FormatLiteral = Field(alias="format")

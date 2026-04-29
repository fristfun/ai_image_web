import base64
from dataclasses import dataclass

from openai import OpenAI

from app.core.config import settings

client = OpenAI(api_key=settings.openai_api_key)


@dataclass
class ImageGenerationResult:
    image_bytes: bytes
    input_text_tokens: int = 0
    input_image_tokens: int = 0
    output_text_tokens: int = 0
    output_image_tokens: int = 0


def _parse_usage(result) -> tuple[int, int, int, int]:
    usage = getattr(result, "usage", None)
    if usage is None:
        return 0, 0, 0, 0

    input_tokens_details = getattr(usage, "input_tokens_details", None)
    output_tokens_details = getattr(usage, "output_tokens_details", None)

    input_text_tokens = int(getattr(input_tokens_details, "text_tokens", 0) or 0)
    input_image_tokens = int(getattr(input_tokens_details, "image_tokens", 0) or 0)
    output_text_tokens = int(getattr(output_tokens_details, "text_tokens", 0) or 0)
    output_image_tokens = int(getattr(output_tokens_details, "image_tokens", 0) or 0)

    # Backward fallback for responses that only provide coarse input/output totals.
    if input_text_tokens == 0 and input_image_tokens == 0:
        input_text_tokens = int(getattr(usage, "input_tokens", 0) or 0)
    if output_text_tokens == 0 and output_image_tokens == 0:
        output_image_tokens = int(getattr(usage, "output_tokens", 0) or 0)
    return input_text_tokens, input_image_tokens, output_text_tokens, output_image_tokens


def generate_image(prompt: str, size: str, quality: str, output_format: str, model: str) -> ImageGenerationResult:
    result = client.images.generate(
        model=model,
        prompt=prompt,
        size=size,
        quality=quality,
        output_format=output_format,
    )
    image_b64 = result.data[0].b64_json
    input_text_tokens, input_image_tokens, output_text_tokens, output_image_tokens = _parse_usage(result)
    return ImageGenerationResult(
        image_bytes=base64.b64decode(image_b64),
        input_text_tokens=input_text_tokens,
        input_image_tokens=input_image_tokens,
        output_text_tokens=output_text_tokens,
        output_image_tokens=output_image_tokens,
    )


def edit_image(
    prompt: str, image_files: list[tuple[str, bytes, str]], size: str, quality: str, output_format: str, model: str
) -> ImageGenerationResult:
    image_payload = []
    for filename, binary, mime_type in image_files:
        image_payload.append((filename, binary, mime_type))
    result = client.images.edit(
        model=model,
        prompt=prompt,
        image=image_payload,
        size=size,
        quality=quality,
        output_format=output_format,
    )
    image_b64 = result.data[0].b64_json
    input_text_tokens, input_image_tokens, output_text_tokens, output_image_tokens = _parse_usage(result)
    return ImageGenerationResult(
        image_bytes=base64.b64decode(image_b64),
        input_text_tokens=input_text_tokens,
        input_image_tokens=input_image_tokens,
        output_text_tokens=output_text_tokens,
        output_image_tokens=output_image_tokens,
    )

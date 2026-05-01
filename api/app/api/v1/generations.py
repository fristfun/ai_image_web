from datetime import datetime
import logging
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, UploadFile
from openai import (
    APIConnectionError,
    APIStatusError,
    APITimeoutError,
    AuthenticationError,
    BadRequestError,
    InternalServerError,
    PermissionDeniedError,
    RateLimitError,
)
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.billing_rules import BILLING_RULES_KEY, parse_billing_rules
from app.core.config import settings
from app.core.database import get_db
from app.core.errors import ApiError
from app.core.image_sizes import IMAGE_SIZE_OPTIONS_KEY, allowed_image_size_values
from app.core.openai_config import OPENAI_API_KEY_SETTING_KEY, resolve_openai_api_key
from app.models.enums import ImageFormat, ImageQuality, TaskStatus
from app.models.generated_image import GeneratedImage
from app.models.generation_task import GenerationTask
from app.models.site_setting import SiteSetting
from app.models.uploaded_asset import UploadedAsset
from app.models.user import User
from app.models.wallet_hold import WalletHold
from app.services.openai_service import edit_image, generate_image
from app.services.pricing_service import calculate_price, calculate_usage_cost_usd, estimate_usd_price, points_from_usd
from app.services.storage.local import LocalStorageProvider
from app.services.wallet_service import freeze_for_generation, release_hold, settle_hold

router = APIRouter(prefix="/generations", tags=["generations"])
logger = logging.getLogger(__name__)

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_FILE_SIZE = 10 * 1024 * 1024
ALLOWED_IMAGE_MODELS = {item.strip() for item in settings.image_model_allowlist.split(",") if item.strip()}


def parse_size(size: str) -> tuple[int, int]:
    if size == "auto":
        return 0, 0
    width, height = size.split("x")
    return int(width), int(height)


def get_provider_error(exc: Exception) -> tuple[int, str]:
    if isinstance(exc, AuthenticationError):
        return 401, "OpenAI API Key 无效，请检查后端配置。"

    if isinstance(exc, PermissionDeniedError):
        text = str(exc)
        if "organization must be verified" in text:
            return 403, "当前组织未通过 OpenAI 验证，暂时无法使用 gpt-image-2。"
        return 403, "OpenAI 权限不足，无法调用当前模型。"

    if isinstance(exc, BadRequestError):
        text = str(exc)
        if "Billing hard limit has been reached" in text:
            return 402, "OpenAI 账户额度已用尽（Billing hard limit reached）。"
        return 400, f"OpenAI 请求参数错误：{text}"

    if isinstance(exc, RateLimitError):
        return 429, "OpenAI 请求过于频繁，请稍后重试。"

    if isinstance(exc, APITimeoutError):
        return 504, "OpenAI 图像服务响应超时，请稍后重试。"

    if isinstance(exc, APIConnectionError):
        return 503, "连接 OpenAI 图像服务失败，请检查网络后重试。"

    if isinstance(exc, InternalServerError):
        return 502, "OpenAI 图像服务内部错误，请稍后重试。"

    if isinstance(exc, APIStatusError):
        return exc.status_code or 502, f"OpenAI 服务异常（HTTP {exc.status_code}），请稍后重试。"

    return 502, "图像服务暂时不可用，请稍后重试。"


@router.post("")
async def create_generation(
    prompt: str = Form(...),
    size: str = Form(...),
    quality: str = Form(...),
    output_format: str = Form(...),
    model: str = Form(default=settings.image_model_default),
    reference_images: list[UploadFile] = File(default=[]),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if len(reference_images) > 5:
        raise ApiError(code="TOO_MANY_REFERENCES", message="参考图最多 5 张")
    size_setting = db.query(SiteSetting).filter(SiteSetting.setting_key == IMAGE_SIZE_OPTIONS_KEY).first()
    allowed_sizes = allowed_image_size_values(size_setting.setting_value if size_setting else None)
    if size not in allowed_sizes:
        raise ApiError(code="INVALID_SIZE", message="尺寸无效")
    if quality not in {"low", "medium", "high"}:
        raise ApiError(code="INVALID_QUALITY", message="质量无效")
    if output_format not in {"webp", "png", "jpeg"}:
        raise ApiError(code="INVALID_FORMAT", message="输出格式无效")
    if model not in ALLOWED_IMAGE_MODELS:
        raise ApiError(code="INVALID_MODEL", message="生图模型无效")
    if user.arrears_points > 0:
        raise ApiError(
            code="HAS_ARREARS",
            message=f"当前账户存在欠费 {user.arrears_points} 积分，请先充值后再生成。",
            status_code=402,
        )

    billing_setting = db.query(SiteSetting).filter(SiteSetting.setting_key == BILLING_RULES_KEY).first()
    billing_rules = parse_billing_rules(billing_setting.setting_value if billing_setting else None)
    api_key_setting = db.query(SiteSetting).filter(SiteSetting.setting_key == OPENAI_API_KEY_SETTING_KEY).first()
    openai_api_key = resolve_openai_api_key(api_key_setting.setting_value if api_key_setting else None)
    price = calculate_price(size=size, quality=quality, rules=billing_rules)
    task = GenerationTask(
        user_id=user.id,
        prompt=prompt,
        size=size,
        quality=ImageQuality(quality),
        output_format=ImageFormat(output_format),
        status=TaskStatus.PENDING,
        price_points=price,
    )
    db.add(task)
    db.flush()
    freeze_for_generation(db, user.id, task.id, price)
    task.status = TaskStatus.PROCESSING
    db.commit()

    storage = LocalStorageProvider()
    try:
        image_payload: list[tuple[str, bytes, str]] = []
        for file in reference_images:
            content = await file.read()
            if file.content_type not in ALLOWED_TYPES:
                raise ApiError(code="INVALID_FILE_TYPE", message="文件类型仅支持 jpg/jpeg/png/webp")
            if len(content) > MAX_FILE_SIZE:
                raise ApiError(code="FILE_TOO_LARGE", message="单张图片最大 10MB")
            image_payload.append((file.filename or "ref", content, file.content_type))
            ref_path = storage.save_bytes(content, f"refs/{user.id}/{uuid4().hex}_{file.filename}")
            db.add(
                UploadedAsset(
                    user_id=user.id,
                    generation_task_id=task.id,
                    file_path=ref_path,
                    mime_type=file.content_type,
                    file_size=len(content),
                )
            )

        if image_payload:
            generated = edit_image(
                prompt,
                image_payload,
                size=size,
                quality=quality,
                output_format=output_format,
                model=model,
                api_key=openai_api_key,
            )
        else:
            generated = generate_image(prompt, size=size, quality=quality, output_format=output_format, model=model, api_key=openai_api_key)

        usage_cost_usd = calculate_usage_cost_usd(
            input_text_tokens=generated.input_text_tokens,
            input_image_tokens=generated.input_image_tokens,
            output_text_tokens=generated.output_text_tokens,
            output_image_tokens=generated.output_image_tokens,
            rules=billing_rules,
        )
        actual_cost_usd = usage_cost_usd if usage_cost_usd > 0 else estimate_usd_price(size=size, quality=quality, rules=billing_rules)
        actual_points = points_from_usd(actual_cost_usd, rules=billing_rules)
        task.price_points = actual_points
        task.actual_cost_usd = actual_cost_usd

        filename = f"{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{uuid4().hex}.{output_format}"
        file_path = storage.save_bytes(generated.image_bytes, f"generated/{user.id}/{filename}")
        width, height = parse_size(size)
        db.add(
            GeneratedImage(
                user_id=user.id,
                generation_task_id=task.id,
                file_path=file_path,
                output_format=output_format,
                width=width,
                height=height,
            )
        )
        hold_row = db.query(WalletHold).filter(WalletHold.generation_task_id == task.id).one()
        settlement = settle_hold(db, hold_row, actual_points)
        task.status = TaskStatus.SUCCESS
        db.commit()
        return {
            "task_id": task.id,
            "status": "SUCCESS",
            "file_path": file_path,
            "price_points": task.price_points,
            "charged_points": settlement["actual_charged_points"],
            "arrears_points": settlement["arrears_incurred"],
            "actual_cost_usd": round(actual_cost_usd, 6),
            "model": model,
        }
    except ApiError as exc:
        db.rollback()
        db_task = db.query(GenerationTask).filter(GenerationTask.id == task.id).one()
        hold_row = db.query(WalletHold).filter(WalletHold.generation_task_id == task.id).first()
        if hold_row:
            release_hold(db, hold_row)
        db_task.status = TaskStatus.FAILED
        db_task.price_points = 0
        db_task.actual_cost_usd = 0
        db_task.error_message = str(exc.detail)[:500] if exc.detail else "ApiError"
        db.commit()
        raise
    except Exception as exc:
        db.rollback()
        logger.exception("Generation failed unexpectedly. task_id=%s user_id=%s", task.id, user.id)
        db_task = db.query(GenerationTask).filter(GenerationTask.id == task.id).one()
        hold_row = db.query(WalletHold).filter(WalletHold.generation_task_id == task.id).first()
        if hold_row:
            release_hold(db, hold_row)
        db_task.status = TaskStatus.FAILED
        db_task.price_points = 0
        db_task.actual_cost_usd = 0
        status_code, message = get_provider_error(exc)
        db_task.error_message = message[:500]
        db.commit()
        raise ApiError(code="GENERATION_FAILED", message=message, status_code=status_code)

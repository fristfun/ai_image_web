from pathlib import Path
from datetime import datetime, timedelta
from uuid import uuid4
from io import StringIO
import csv

from fastapi import APIRouter, Depends, File, Query, Response, UploadFile
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.core.database import get_db
from app.core.errors import ApiError
from app.models.enums import LedgerType, TaskStatus
from app.models.generation_task import GenerationTask
from app.models.order import Order
from app.models.prompt_template_variable import PromptTemplateVariable
from app.models.site_setting import SiteSetting
from app.models.template import PromptTemplate
from app.models.user import User
from app.models.wallet import Wallet
from app.models.wallet_ledger import WalletLedger
from app.services.storage.local import LocalStorageProvider
from app.services.wallet_service import apply_topup

router = APIRouter(prefix="/admin", tags=["admin"])
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_FILE_SIZE = 10 * 1024 * 1024
GENERATE_HINT_KEY = "generate_page_hint"
WECHAT_TOPUP_QR_KEY = "wechat_topup_qr_image_url"


@router.get("/users")
def list_users(
    email: str | None = Query(default=None),
    status: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = db.query(User, Wallet).outerjoin(Wallet, Wallet.user_id == User.id)
    if email:
        query = query.filter(User.email.ilike(f"%{email.strip()}%"))
    if status == "ACTIVE":
        query = query.filter(User.is_active.is_(True))
    elif status == "BANNED":
        query = query.filter(User.is_active.is_(False))

    total = query.count()
    offset = (page - 1) * page_size
    rows = query.order_by(desc(User.id)).offset(offset).limit(page_size).all()
    return {
        "items": [
            {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": user.role.value,
                "is_active": user.is_active,
                "arrears_points": user.arrears_points,
                "last_login_at": user.last_login_at,
                "balance": wallet.balance if wallet else 0,
                "frozen": wallet.frozen if wallet else 0,
                "created_at": user.created_at,
            }
            for user, wallet in rows
        ],
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": (total + page_size - 1) // page_size if total else 0,
        },
    }


@router.post("/users/{user_id}/topup")
def admin_topup_user(user_id: int, payload: dict, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    amount = int(payload.get("amount", 0))
    balance, settled_arrears = apply_topup(db, user_id, amount, reference=f"admin_topup:{_.id}")
    db.add(Order(user_id=user_id, amount=amount, type="TOPUP", status="COMPLETED", reference=f"admin_topup:{_.id}"))
    db.commit()
    return {"ok": True, "balance": balance, "settled_arrears": settled_arrears}


@router.post("/users/{user_id}/ban")
def admin_ban_user(user_id: int, payload: dict, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    is_active = bool(payload.get("is_active", False))
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise ApiError(code="NOT_FOUND", message="用户不存在", status_code=404)
    user.is_active = is_active
    db.commit()
    return {"ok": True, "is_active": user.is_active}


@router.get("/users/{user_id}/topup-records")
def user_topup_records(user_id: int, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    rows = (
        db.query(WalletLedger, User)
        .join(User, User.id == WalletLedger.user_id)
        .filter(
            WalletLedger.user_id == user_id,
            WalletLedger.type == LedgerType.TOPUP,
            WalletLedger.reference.is_not(None),
            WalletLedger.reference.like("admin_topup:%"),
        )
        .order_by(desc(WalletLedger.id))
        .limit(100)
        .all()
    )

    admin_cache: dict[int, User | None] = {}
    records = []
    for ledger, _target_user in rows:
        admin_id = None
        if ledger.reference and ":" in ledger.reference:
            try:
                admin_id = int(ledger.reference.split(":")[1])
            except ValueError:
                admin_id = None
        admin_user = None
        if admin_id is not None:
            if admin_id not in admin_cache:
                admin_cache[admin_id] = db.query(User).filter(User.id == admin_id).first()
            admin_user = admin_cache[admin_id]

        records.append(
            {
                "id": ledger.id,
                "amount": ledger.amount,
                "created_at": ledger.created_at,
                "balance_after": ledger.balance_after,
                "admin_id": admin_user.id if admin_user else None,
                "admin_name": admin_user.username if admin_user else None,
                "admin_email": admin_user.email if admin_user else None,
            }
        )
    return records


@router.get("/orders")
def list_orders(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    start_time: datetime | None = Query(default=None),
    end_time: datetime | None = Query(default=None),
    status: str | None = Query(default=None),
    order_type: str | None = Query(default=None),
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = db.query(Order, User.email).outerjoin(User, User.id == Order.user_id)
    if start_time is not None:
        query = query.filter(Order.created_at >= start_time)
    if end_time is not None:
        query = query.filter(Order.created_at <= end_time)
    if status:
        query = query.filter(Order.status == status)
    if order_type:
        query = query.filter(Order.type == order_type)

    total = query.count()
    offset = (page - 1) * page_size
    rows = query.order_by(desc(Order.id)).offset(offset).limit(page_size).all()
    return {
        "items": [
            {
                "id": order.id,
                "user_id": order.user_id,
                "user_email": user_email,
                "amount": order.amount,
                "type": order.type,
                "status": order.status,
                "reference": order.reference,
                "created_at": order.created_at,
            }
            for order, user_email in rows
        ],
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": (total + page_size - 1) // page_size if total else 0,
        },
    }


@router.get("/orders/stats")
def order_stats(
    start_time: datetime | None = Query(default=None),
    end_time: datetime | None = Query(default=None),
    status: str | None = Query(default=None),
    order_type: str | None = Query(default=None),
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = db.query(Order)
    if start_time is not None:
        query = query.filter(Order.created_at >= start_time)
    if end_time is not None:
        query = query.filter(Order.created_at <= end_time)
    if status:
        query = query.filter(Order.status == status)
    if order_type:
        query = query.filter(Order.type == order_type)

    total_orders = query.count()
    total_amount = query.with_entities(func.coalesce(func.sum(Order.amount), 0)).scalar() or 0
    completed_count = query.filter(Order.status == "COMPLETED").count()
    pending_count = query.filter(Order.status == "PENDING").count()
    failed_count = query.filter(Order.status == "FAILED").count()

    return {
        "total_orders": int(total_orders),
        "total_amount": int(total_amount),
        "completed_count": int(completed_count),
        "pending_count": int(pending_count),
        "failed_count": int(failed_count),
    }


@router.get("/ledgers")
def list_ledgers(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    start_time: datetime | None = Query(default=None),
    end_time: datetime | None = Query(default=None),
    ledger_type: str | None = Query(default=None),
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = db.query(WalletLedger, User.email).outerjoin(User, User.id == WalletLedger.user_id)
    if start_time is not None:
        query = query.filter(WalletLedger.created_at >= start_time)
    if end_time is not None:
        query = query.filter(WalletLedger.created_at <= end_time)
    if ledger_type and ledger_type in {"TOPUP", "FREEZE", "CAPTURE", "RELEASE", "REFUND", "ARREARS_INCUR", "ARREARS_SETTLE"}:
        query = query.filter(WalletLedger.type == LedgerType(ledger_type))

    total = query.count()
    offset = (page - 1) * page_size
    rows = query.order_by(desc(WalletLedger.id)).offset(offset).limit(page_size).all()
    return {
        "items": [
            {
                "id": ledger.id,
                "user_id": ledger.user_id,
                "user_email": user_email,
                "type": ledger.type.value,
                "amount": ledger.amount,
                "balance_after": ledger.balance_after,
                "reference": ledger.reference,
                "created_at": ledger.created_at,
            }
            for ledger, user_email in rows
        ],
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": (total + page_size - 1) // page_size if total else 0,
        },
    }


@router.get("/ledgers/stats")
def ledger_stats(
    start_time: datetime | None = Query(default=None),
    end_time: datetime | None = Query(default=None),
    ledger_type: str | None = Query(default=None),
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = db.query(WalletLedger)
    if start_time is not None:
        query = query.filter(WalletLedger.created_at >= start_time)
    if end_time is not None:
        query = query.filter(WalletLedger.created_at <= end_time)
    if ledger_type and ledger_type in {"TOPUP", "FREEZE", "CAPTURE", "RELEASE", "REFUND", "ARREARS_INCUR", "ARREARS_SETTLE"}:
        query = query.filter(WalletLedger.type == LedgerType(ledger_type))

    total_records = query.count()
    total_amount = query.with_entities(func.coalesce(func.sum(WalletLedger.amount), 0)).scalar() or 0
    income_amount = (
        query.filter(WalletLedger.amount > 0).with_entities(func.coalesce(func.sum(WalletLedger.amount), 0)).scalar() or 0
    )
    expense_amount = (
        query.filter(WalletLedger.amount < 0).with_entities(func.coalesce(func.sum(WalletLedger.amount), 0)).scalar() or 0
    )
    unique_users = query.with_entities(func.count(func.distinct(WalletLedger.user_id))).scalar() or 0

    return {
        "total_records": int(total_records),
        "total_amount": int(total_amount),
        "income_amount": int(income_amount),
        "expense_amount": int(expense_amount),
        "unique_users": int(unique_users),
    }


@router.get("/generations")
def list_generations(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    start_time: datetime | None = Query(default=None),
    end_time: datetime | None = Query(default=None),
    status: str | None = Query(default=None),
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = db.query(GenerationTask, User.email).outerjoin(User, User.id == GenerationTask.user_id)
    if start_time is not None:
        query = query.filter(GenerationTask.created_at >= start_time)
    if end_time is not None:
        query = query.filter(GenerationTask.created_at <= end_time)
    if status in {"SUCCESS", "FAILED"}:
        query = query.filter(GenerationTask.status == TaskStatus(status))

    total = query.count()
    offset = (page - 1) * page_size
    rows = query.order_by(desc(GenerationTask.id)).offset(offset).limit(page_size).all()

    return {
        "items": [
            {
                "id": task.id,
                "user_id": task.user_id,
                "user_email": user_email,
                "status": task.status.value,
                "prompt": task.prompt,
                "size": task.size.value,
                "quality": task.quality.value,
                "format": task.output_format.value,
                "price_points": task.price_points,
                "actual_cost_usd": round(task.actual_cost_usd or 0, 6),
                "created_at": task.created_at,
                "error_message": task.error_message,
            }
            for task, user_email in rows
        ],
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": (total + page_size - 1) // page_size if total else 0,
        },
    }


@router.get("/generations/export-csv")
def export_generations_csv(
    start_time: datetime | None = Query(default=None),
    end_time: datetime | None = Query(default=None),
    status: str | None = Query(default=None),
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = db.query(GenerationTask)
    if start_time is not None:
        query = query.filter(GenerationTask.created_at >= start_time)
    if end_time is not None:
        query = query.filter(GenerationTask.created_at <= end_time)
    if status in {"SUCCESS", "FAILED"}:
        query = query.filter(GenerationTask.status == TaskStatus(status))
    rows = query.order_by(desc(GenerationTask.id)).all()

    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "user_id", "status", "size", "quality", "format", "price_points", "actual_cost_usd", "created_at", "prompt", "error_message"])
    for x in rows:
        writer.writerow(
            [
                x.id,
                x.user_id,
                x.status.value,
                x.size.value,
                x.quality.value,
                x.output_format.value,
                x.price_points,
                round(x.actual_cost_usd or 0, 6),
                x.created_at.isoformat() if x.created_at else "",
                x.prompt,
                x.error_message or "",
            ]
        )

    filename = f"generations_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/generations/stats/today")
def today_generation_stats(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    now = datetime.now()
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=1)

    base_query = db.query(GenerationTask).filter(GenerationTask.created_at >= start, GenerationTask.created_at < end)
    total_images = base_query.count()
    unique_users = db.query(func.count(func.distinct(GenerationTask.user_id))).filter(
        GenerationTask.created_at >= start, GenerationTask.created_at < end
    ).scalar() or 0
    total_points = base_query.with_entities(func.coalesce(func.sum(GenerationTask.price_points), 0)).scalar() or 0
    total_actual_cost = base_query.with_entities(func.coalesce(func.sum(GenerationTask.actual_cost_usd), 0.0)).scalar() or 0.0
    success_count = base_query.filter(GenerationTask.status == TaskStatus.SUCCESS).count()
    failed_count = base_query.filter(GenerationTask.status == TaskStatus.FAILED).count()

    return {
        "unique_users": int(unique_users),
        "total_images": int(total_images),
        "total_points": int(total_points),
        "total_actual_cost_usd": round(float(total_actual_cost), 2),
        "success_count": int(success_count),
        "failed_count": int(failed_count),
    }


@router.get("/templates")
def list_templates(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    rows = db.query(PromptTemplate).order_by(desc(PromptTemplate.id)).limit(100).all()
    return [{"id": x.id, "category": x.category, "title": x.title, "effect_image_url": x.effect_image_url} for x in rows]


@router.get("/templates/{template_id}")
def get_template(template_id: int, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    item = db.query(PromptTemplate).filter(PromptTemplate.id == template_id).first()
    if item is None:
        raise ApiError(code="NOT_FOUND", message="模板不存在", status_code=404)
    variables = (
        db.query(PromptTemplateVariable)
        .filter(PromptTemplateVariable.template_id == item.id)
        .order_by(PromptTemplateVariable.id.asc())
        .all()
    )
    return {
        "id": item.id,
        "category": item.category,
        "title": item.title,
        "content": item.content,
        "variable_desc": item.variable_desc,
        "effect_image_url": item.effect_image_url,
        "default_size": item.default_size,
        "default_quality": item.default_quality,
        "variables": [
            {"name": x.name, "description": x.description, "example_value": x.example_value}
            for x in variables
        ],
    }


@router.post("/templates")
def create_template(payload: dict, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    item = PromptTemplate(
        category=payload.get("category", "default"),
        title=payload.get("title", "untitled"),
        content=payload.get("content", ""),
        variable_desc=payload.get("variable_desc"),
        effect_image_url=payload.get("effect_image_url"),
        default_size=payload.get("default_size", "1024x1024"),
        default_quality=payload.get("default_quality", "medium"),
    )
    db.add(item)
    db.flush()

    variables = payload.get("variables", [])
    for variable in variables:
        db.add(
            PromptTemplateVariable(
                template_id=item.id,
                name=variable.get("name", ""),
                description=variable.get("description", ""),
                example_value=variable.get("example_value", ""),
            )
        )

    db.commit()
    return {"id": item.id}


@router.put("/templates/{template_id}")
def update_template(template_id: int, payload: dict, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    item = db.query(PromptTemplate).filter(PromptTemplate.id == template_id).first()
    if item is None:
        raise ApiError(code="NOT_FOUND", message="模板不存在", status_code=404)

    item.category = payload.get("category", item.category)
    item.title = payload.get("title", item.title)
    item.content = payload.get("content", item.content)
    item.variable_desc = payload.get("variable_desc", item.variable_desc)
    item.effect_image_url = payload.get("effect_image_url", item.effect_image_url)
    item.default_size = payload.get("default_size", item.default_size)
    item.default_quality = payload.get("default_quality", item.default_quality)

    variables = payload.get("variables")
    if isinstance(variables, list):
        db.query(PromptTemplateVariable).filter(PromptTemplateVariable.template_id == item.id).delete()
        for variable in variables:
            db.add(
                PromptTemplateVariable(
                    template_id=item.id,
                    name=variable.get("name", ""),
                    description=variable.get("description", ""),
                    example_value=variable.get("example_value", ""),
                )
            )

    db.commit()
    return {"ok": True}


@router.delete("/templates/{template_id}")
def delete_template(template_id: int, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    item = db.query(PromptTemplate).filter(PromptTemplate.id == template_id).first()
    if item is None:
        raise ApiError(code="NOT_FOUND", message="模板不存在", status_code=404)
    db.query(PromptTemplateVariable).filter(PromptTemplateVariable.template_id == item.id).delete()
    db.delete(item)
    db.commit()
    return {"ok": True}


@router.post("/templates/upload-effect-image")
async def upload_template_effect_image(file: UploadFile = File(...), _: User = Depends(require_admin)):
    content = await file.read()
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise ApiError(code="INVALID_FILE_TYPE", message="效果图仅支持 jpg/jpeg/png/webp")
    if len(content) > MAX_FILE_SIZE:
        raise ApiError(code="FILE_TOO_LARGE", message="效果图最大 10MB")

    ext = Path(file.filename or "effect.webp").suffix or ".webp"
    relative_path = f"templates/effects/{uuid4().hex}{ext}"
    storage = LocalStorageProvider()
    file_path = storage.save_bytes(content, relative_path)
    return {"effect_image_url": file_path}


@router.get("/settings/generate-hint")
def get_generate_hint_setting(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    row = db.query(SiteSetting).filter(SiteSetting.setting_key == GENERATE_HINT_KEY).first()
    return {"hint_text": row.setting_value if row else ""}


@router.put("/settings/generate-hint")
def update_generate_hint_setting(payload: dict, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    hint_text = str(payload.get("hint_text", "")).strip()
    row = db.query(SiteSetting).filter(SiteSetting.setting_key == GENERATE_HINT_KEY).first()
    if row is None:
        row = SiteSetting(setting_key=GENERATE_HINT_KEY, setting_value=hint_text)
        db.add(row)
    else:
        row.setting_value = hint_text
    db.commit()
    return {"ok": True}


@router.get("/settings/wechat-topup-qr")
def get_wechat_topup_qr_setting(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    row = db.query(SiteSetting).filter(SiteSetting.setting_key == WECHAT_TOPUP_QR_KEY).first()
    return {"qr_image_url": row.setting_value if row else ""}


@router.put("/settings/wechat-topup-qr")
def update_wechat_topup_qr_setting(payload: dict, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    qr_image_url = str(payload.get("qr_image_url", "")).strip()
    row = db.query(SiteSetting).filter(SiteSetting.setting_key == WECHAT_TOPUP_QR_KEY).first()
    if row is None:
        row = SiteSetting(setting_key=WECHAT_TOPUP_QR_KEY, setting_value=qr_image_url)
        db.add(row)
    else:
        row.setting_value = qr_image_url
    db.commit()
    return {"ok": True}


@router.post("/settings/upload-wechat-topup-qr")
async def upload_wechat_topup_qr(file: UploadFile = File(...), _: User = Depends(require_admin)):
    content = await file.read()
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise ApiError(code="INVALID_FILE_TYPE", message="二维码仅支持 jpg/jpeg/png/webp")
    if len(content) > MAX_FILE_SIZE:
        raise ApiError(code="FILE_TOO_LARGE", message="二维码图片最大 10MB")

    ext = Path(file.filename or "wechat-qr.webp").suffix or ".webp"
    relative_path = f"settings/wechat-topup-qr/{uuid4().hex}{ext}"
    storage = LocalStorageProvider()
    file_path = storage.save_bytes(content, relative_path)
    return {"qr_image_url": file_path}

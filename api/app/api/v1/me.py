from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.generated_image import GeneratedImage
from app.models.generation_task import GenerationTask
from app.models.user import User
from app.models.wallet import Wallet
from app.models.wallet_ledger import WalletLedger

router = APIRouter(prefix="/me", tags=["me"])


@router.get("/wallet")
def my_wallet(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    start_time: datetime | None = Query(default=None),
    end_time: datetime | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    wallet = db.query(Wallet).filter(Wallet.user_id == user.id).first()
    ledger_query = db.query(WalletLedger).filter(WalletLedger.user_id == user.id)
    if start_time is not None:
        ledger_query = ledger_query.filter(WalletLedger.created_at >= start_time)
    if end_time is not None:
        ledger_query = ledger_query.filter(WalletLedger.created_at <= end_time)

    total = ledger_query.count()
    offset = (page - 1) * page_size
    ledger = ledger_query.order_by(desc(WalletLedger.id)).offset(offset).limit(page_size).all()
    total_pages = (total + page_size - 1) // page_size if total else 0

    return {
        "balance": wallet.balance if wallet else 0,
        "frozen": wallet.frozen if wallet else 0,
        "arrears_points": user.arrears_points,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": total_pages,
        },
        "ledger": [
            {"id": x.id, "type": x.type.value, "amount": x.amount, "balance_after": x.balance_after, "created_at": x.created_at}
            for x in ledger
        ],
    }


@router.get("/generations")
def my_generations(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = (
        db.query(GenerationTask, GeneratedImage)
        .outerjoin(GeneratedImage, GeneratedImage.generation_task_id == GenerationTask.id)
        .filter(GenerationTask.user_id == user.id)
        .order_by(desc(GenerationTask.id))
        .limit(50)
        .all()
    )
    return [
        {
            "id": task.id,
            "prompt": task.prompt,
            "size": task.size,
            "quality": task.quality.value,
            "format": task.output_format.value,
            "status": task.status.value,
            # Only successful tasks should show charged points in history.
            "price_points": task.price_points if task.status.value == "SUCCESS" else 0,
            "created_at": task.created_at,
            "image_file_path": image.file_path if image else None,
        }
        for task, image in rows
    ]

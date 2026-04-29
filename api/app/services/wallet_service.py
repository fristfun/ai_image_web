from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.models.enums import LedgerType
from app.models.user import User
from app.models.wallet import Wallet
from app.models.wallet_hold import WalletHold
from app.models.wallet_ledger import WalletLedger


def freeze_for_generation(db: Session, user_id: int, generation_task_id: int, amount: int) -> WalletHold:
    wallet = db.query(Wallet).filter(Wallet.user_id == user_id).with_for_update().one()
    if wallet.balance <= 0:
        raise ApiError(code="INSUFFICIENT_BALANCE", message="余额不足", status_code=402)

    freeze_amount = min(wallet.balance, max(0, amount))
    wallet.balance -= freeze_amount
    wallet.frozen += freeze_amount
    hold = WalletHold(
        user_id=user_id,
        wallet_id=wallet.id,
        generation_task_id=generation_task_id,
        amount=freeze_amount,
        status="FROZEN",
    )
    db.add(hold)
    db.add(
        WalletLedger(
            user_id=user_id,
            wallet_id=wallet.id,
            type=LedgerType.FREEZE,
            amount=-freeze_amount,
            balance_after=wallet.balance,
            reference=f"generation:{generation_task_id}",
        )
    )
    db.flush()
    return hold


def capture_hold(db: Session, hold: WalletHold) -> None:
    settle_hold(db, hold, hold.amount)


def settle_hold(db: Session, hold: WalletHold, final_amount: int) -> dict[str, int]:
    wallet = db.query(Wallet).filter(Wallet.id == hold.wallet_id).with_for_update().one()
    user = db.query(User).filter(User.id == hold.user_id).with_for_update().one()
    if hold.status != "FROZEN":
        return {"actual_charged_points": 0, "arrears_incurred": 0}

    if final_amount < 0:
        final_amount = 0

    original_amount = hold.amount
    delta = original_amount - final_amount

    actual_charged_points = min(original_amount, final_amount)
    capture_amount = 0
    arrears_incurred = 0

    if delta < 0:
        extra_charge = -delta
        chargeable = min(wallet.balance, extra_charge)
        if chargeable > 0:
            wallet.balance -= chargeable
            capture_amount = -chargeable
            actual_charged_points += chargeable
        arrears_incurred = extra_charge - chargeable
        if arrears_incurred > 0:
            user.arrears_points += arrears_incurred
            db.add(
                WalletLedger(
                    user_id=hold.user_id,
                    wallet_id=wallet.id,
                    type=LedgerType.ARREARS_INCUR,
                    amount=-arrears_incurred,
                    balance_after=wallet.balance,
                    reference=f"generation:{hold.generation_task_id}",
                )
            )
    elif delta > 0:
        wallet.balance += delta
        db.add(
            WalletLedger(
                user_id=hold.user_id,
                wallet_id=wallet.id,
                type=LedgerType.RELEASE,
                amount=delta,
                balance_after=wallet.balance,
                reference=f"generation:{hold.generation_task_id}",
            )
        )
    wallet.frozen -= original_amount
    hold.amount = final_amount
    hold.status = "CAPTURED"
    if capture_amount != 0:
        db.add(
            WalletLedger(
                user_id=hold.user_id,
                wallet_id=wallet.id,
                type=LedgerType.CAPTURE,
                amount=capture_amount,
                balance_after=wallet.balance,
                reference=f"generation:{hold.generation_task_id}",
            )
        )
    return {"actual_charged_points": actual_charged_points, "arrears_incurred": arrears_incurred}


def release_hold(db: Session, hold: WalletHold) -> None:
    wallet = db.query(Wallet).filter(Wallet.id == hold.wallet_id).with_for_update().one()
    if hold.status != "FROZEN":
        return
    wallet.frozen -= hold.amount
    wallet.balance += hold.amount
    hold.status = "RELEASED"
    hold.released_at = datetime.now(tz=timezone.utc)
    db.add(
        WalletLedger(
            user_id=hold.user_id,
            wallet_id=wallet.id,
            type=LedgerType.RELEASE,
            amount=hold.amount,
            balance_after=wallet.balance,
            reference=f"generation:{hold.generation_task_id}",
        )
    )


def apply_topup(db: Session, user_id: int, amount: int, reference: str) -> tuple[int, int]:
    if amount <= 0:
        raise ApiError(code="INVALID_AMOUNT", message="充值金额必须大于0")

    user = db.query(User).filter(User.id == user_id).with_for_update().first()
    if user is None:
        raise ApiError(code="NOT_FOUND", message="用户不存在", status_code=404)

    wallet = db.query(Wallet).filter(Wallet.user_id == user_id).with_for_update().first()
    if wallet is None:
        wallet = Wallet(user_id=user_id, balance=0, frozen=0)
        db.add(wallet)
        db.flush()

    wallet.balance += amount
    db.add(
        WalletLedger(
            user_id=user_id,
            wallet_id=wallet.id,
            type=LedgerType.TOPUP,
            amount=amount,
            balance_after=wallet.balance,
            reference=reference,
        )
    )

    settled_arrears = min(user.arrears_points, amount)
    if settled_arrears > 0:
        wallet.balance -= settled_arrears
        user.arrears_points -= settled_arrears
        db.add(
            WalletLedger(
                user_id=user_id,
                wallet_id=wallet.id,
                type=LedgerType.ARREARS_SETTLE,
                amount=-settled_arrears,
                balance_after=wallet.balance,
                reference=reference,
            )
        )

    return wallet.balance, settled_arrears

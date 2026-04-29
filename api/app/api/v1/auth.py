from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.errors import ApiError
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.models.wallet import Wallet
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    exists = db.query(User).filter(User.email == payload.email).first()
    if exists:
        raise ApiError(code="EMAIL_EXISTS", message="邮箱已注册", status_code=409)

    username = payload.username.strip()
    if not username:
        raise ApiError(code="INVALID_USERNAME", message="用户名不能为空", status_code=422)

    user = User(username=username, email=payload.email, password_hash=hash_password(payload.password))
    db.add(user)
    db.flush()
    db.add(Wallet(user_id=user.id, balance=0, frozen=0))
    db.commit()
    token = create_access_token(user_id=user.id, role=user.role.value, username=user.username)
    return TokenResponse(access_token=token, username=user.username)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise ApiError(code="INVALID_CREDENTIALS", message="邮箱或密码错误", status_code=401)
    if not user.is_active:
        raise ApiError(code="USER_DISABLED", message="账号已被封禁", status_code=403)
    user.last_login_at = datetime.now(tz=timezone.utc)
    db.commit()
    token = create_access_token(user_id=user.id, role=user.role.value, username=user.username)
    return TokenResponse(access_token=token, username=user.username)

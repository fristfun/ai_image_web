from fastapi import Depends, Header
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.errors import ApiError
from app.models.user import User


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise ApiError(code="UNAUTHORIZED", message="未登录", status_code=401)
    token = authorization.replace("Bearer ", "")
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise ApiError(code="UNAUTHORIZED", message="登录状态无效", status_code=401)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ApiError(code="UNAUTHORIZED", message="用户不存在", status_code=401)
    if not user.is_active:
        raise ApiError(code="USER_DISABLED", message="账号已被封禁", status_code=403)
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role.value != "ADMIN":
        raise ApiError(code="FORBIDDEN", message="无后台访问权限", status_code=403)
    return user

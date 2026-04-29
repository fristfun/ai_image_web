from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.site_setting import SiteSetting
from app.models.user import User

router = APIRouter(prefix="/settings", tags=["settings"])
GENERATE_HINT_KEY = "generate_page_hint"
WECHAT_TOPUP_QR_KEY = "wechat_topup_qr_image_url"


@router.get("/generate-hint")
def get_generate_hint(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.query(SiteSetting).filter(SiteSetting.setting_key == GENERATE_HINT_KEY).first()
    return {
        "hint_text": row.setting_value if row else "",
        "billing_cost_multiplier": settings.billing_cost_multiplier,
    }


@router.get("/wechat-topup-qr")
def get_wechat_topup_qr(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.query(SiteSetting).filter(SiteSetting.setting_key == WECHAT_TOPUP_QR_KEY).first()
    return {"qr_image_url": row.setting_value if row else ""}

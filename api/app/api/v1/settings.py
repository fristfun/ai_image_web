from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.billing_rules import BILLING_RULES_KEY, parse_billing_rules
from app.core.database import get_db
from app.core.image_sizes import IMAGE_SIZE_OPTIONS_KEY, parse_image_size_options
from app.models.site_setting import SiteSetting
from app.models.user import User

router = APIRouter(prefix="/settings", tags=["settings"])
GENERATE_HINT_KEY = "generate_page_hint"
WECHAT_TOPUP_QR_KEY = "wechat_topup_qr_image_url"


@router.get("/generate-hint")
def get_generate_hint(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.query(SiteSetting).filter(SiteSetting.setting_key == GENERATE_HINT_KEY).first()
    billing_row = db.query(SiteSetting).filter(SiteSetting.setting_key == BILLING_RULES_KEY).first()
    billing_rules = parse_billing_rules(billing_row.setting_value if billing_row else None)
    return {
        "hint_text": row.setting_value if row else "",
        "billing_cost_multiplier": billing_rules["billing_cost_multiplier"],
    }


@router.get("/billing-rules")
def get_billing_rules(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.query(SiteSetting).filter(SiteSetting.setting_key == BILLING_RULES_KEY).first()
    rules = parse_billing_rules(row.setting_value if row else None)
    return {"rules": rules}


@router.get("/image-sizes")
def get_image_sizes(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.query(SiteSetting).filter(SiteSetting.setting_key == IMAGE_SIZE_OPTIONS_KEY).first()
    return {"options": parse_image_size_options(row.setting_value if row else None)}


@router.get("/wechat-topup-qr")
def get_wechat_topup_qr(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.query(SiteSetting).filter(SiteSetting.setting_key == WECHAT_TOPUP_QR_KEY).first()
    return {"qr_image_url": row.setting_value if row else ""}

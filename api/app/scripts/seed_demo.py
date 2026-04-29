from app.core.security import hash_password
from app.core.database import SessionLocal
from app.models.enums import LedgerType, UserRole
from app.models.template import PromptTemplate
from app.models.user import User
from app.models.wallet import Wallet
from app.models.wallet_ledger import WalletLedger


def run() -> None:
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.email == "admin@example.com").first()
        if admin is None:
            admin = User(username="管理员", email="admin@example.com", password_hash=hash_password("admin123456"), role=UserRole.ADMIN)
            db.add(admin)
            db.flush()
            wallet = Wallet(user_id=admin.id, balance=10000, frozen=0)
            db.add(wallet)
            db.flush()
            db.add(
                WalletLedger(
                    user_id=admin.id,
                    wallet_id=wallet.id,
                    type=LedgerType.TOPUP,
                    amount=10000,
                    balance_after=10000,
                    reference="seed",
                )
            )
        elif not admin.username:
            admin.username = "管理员"

        template_exists = db.query(PromptTemplate).first()
        if template_exists is None:
            db.add(
                PromptTemplate(
                    category="电商",
                    title="商品白底图",
                    content="请生成一张高质量商品主图，主体：{{product}}，风格：{{style}}，背景纯白。",
                    variable_desc="product: 商品名称; style: 风格",
                    effect_image_url="https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80",
                    default_size="1024x1024",
                    default_quality="high",
                )
            )
        db.commit()
        print("seed done: admin@example.com / admin123456")
    finally:
        db.close()


if __name__ == "__main__":
    run()

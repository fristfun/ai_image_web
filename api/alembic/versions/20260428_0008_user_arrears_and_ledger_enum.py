"""add user arrears points and ledger enum values

Revision ID: 20260428_0008
Revises: 20260428_0007
Create Date: 2026-04-28 22:24:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260428_0008"
down_revision = "20260428_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    user_columns = {column["name"] for column in inspector.get_columns("users")}
    if "arrears_points" not in user_columns:
        op.add_column("users", sa.Column("arrears_points", sa.Integer(), nullable=False, server_default="0"))

    if bind.dialect.name == "postgresql":
        op.execute("ALTER TYPE ledgertype ADD VALUE IF NOT EXISTS 'ARREARS_INCUR'")
        op.execute("ALTER TYPE ledgertype ADD VALUE IF NOT EXISTS 'ARREARS_SETTLE'")


def downgrade() -> None:
    op.drop_column("users", "arrears_points")

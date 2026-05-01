"""expand configurable image sizes

Revision ID: 20260501_0009
Revises: 20260428_0008
Create Date: 2026-05-01 15:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260501_0009"
down_revision = "20260428_0008"
branch_labels = None
depends_on = None


NEW_IMAGE_SIZES = [
    "auto",
    "2048x2048",
    "2048x1152",
    "2160x3840",
    "3840x2160",
    "1088x1920",
    "1920x1088",
    "1440x1440",
    "1280x1920",
    "1920x1280",
]


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        with op.batch_alter_table("generation_tasks") as batch_op:
            batch_op.alter_column("size", type_=sa.String(length=32), existing_nullable=False)
        return

    op.execute("ALTER TABLE generation_tasks ALTER COLUMN size TYPE varchar(32) USING size::text")
    for value in NEW_IMAGE_SIZES:
        op.execute(f"ALTER TYPE imagesize ADD VALUE IF NOT EXISTS '{value}'")


def downgrade() -> None:
    # PostgreSQL enum values cannot be removed safely without rebuilding dependent columns.
    pass

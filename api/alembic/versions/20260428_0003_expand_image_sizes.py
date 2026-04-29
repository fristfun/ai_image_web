"""expand generation size enum

Revision ID: 20260428_0003
Revises: 20260428_0002
Create Date: 2026-04-28 15:22:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260428_0003"
down_revision = "20260428_0002"
branch_labels = None
depends_on = None


OLD_IMAGE_SIZE_ENUM = sa.Enum("1024x1024", "1024x1536", "1536x1024", name="imagesize")
NEW_IMAGE_SIZE_ENUM = sa.Enum(
    "256x256",
    "512x512",
    "1024x1024",
    "1024x1536",
    "1536x1024",
    "1024x1792",
    "1792x1024",
    name="imagesize",
)


def upgrade() -> None:
    with op.batch_alter_table("generation_tasks", recreate="always") as batch_op:
        batch_op.alter_column("size", existing_type=OLD_IMAGE_SIZE_ENUM, type_=NEW_IMAGE_SIZE_ENUM, existing_nullable=False)


def downgrade() -> None:
    with op.batch_alter_table("generation_tasks", recreate="always") as batch_op:
        batch_op.alter_column("size", existing_type=NEW_IMAGE_SIZE_ENUM, type_=OLD_IMAGE_SIZE_ENUM, existing_nullable=False)

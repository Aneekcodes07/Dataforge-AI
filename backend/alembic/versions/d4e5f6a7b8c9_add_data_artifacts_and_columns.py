"""add data_artifacts and dataset_columns tables

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-06-25 19:30:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, Sequence[str], None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "data_artifacts",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("dataset_id", sa.UUID(), nullable=False),
        sa.Column("run_id", sa.UUID(), nullable=True),
        sa.Column("storage_key", sa.String(length=1024), nullable=False),
        sa.Column("format", sa.String(length=20), nullable=False),
        sa.Column("row_count", sa.Integer(), nullable=False),
        sa.Column("column_count", sa.Integer(), nullable=False),
        sa.Column("byte_size", sa.BigInteger(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("row_count >= 0", name="artifact_rows_non_negative"),
        sa.ForeignKeyConstraint(["dataset_id"], ["datasets.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["run_id"], ["pipeline_runs.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_data_artifacts_dataset_id"),
        "data_artifacts",
        ["dataset_id"],
        unique=False,
    )
    op.create_table(
        "dataset_columns",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("dataset_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("dtype", sa.String(length=50), nullable=False),
        sa.Column("null_rate", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column("unique_count", sa.Integer(), nullable=False),
        sa.Column(
            "sample_values",
            postgresql.JSONB(astext_type=sa.Text()).with_variant(sa.JSON(), "sqlite"),
            nullable=True,
        ),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["dataset_id"], ["datasets.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_dataset_columns_dataset_id"),
        "dataset_columns",
        ["dataset_id"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_dataset_columns_dataset_id"), table_name="dataset_columns")
    op.drop_table("dataset_columns")
    op.drop_index(op.f("ix_data_artifacts_dataset_id"), table_name="data_artifacts")
    op.drop_table("data_artifacts")

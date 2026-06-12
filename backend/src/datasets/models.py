"""
Datasets models — Datasets database mapping.
"""

import uuid
from datetime import datetime
from sqlalchemy import (
    Column,
    String,
    Integer,
    Numeric,
    ForeignKey,
    DateTime,
    Boolean,
    CheckConstraint,
    Index,
    JSON,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship, Mapped
from src.core.database import Base


class Dataset(Base):
    __tablename__ = "datasets"

    id: Mapped[uuid.UUID] = Column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    workspace_id: Mapped[uuid.UUID] = Column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    name: Mapped[str] = Column(String(255), nullable=False)
    source_type: Mapped[str | None] = Column(String(50), nullable=True)
    description: Mapped[str | None] = Column(String, nullable=True)
    s3_path: Mapped[str | None] = Column(String(512), nullable=True)
    schema_config: Mapped[dict | None] = Column(
        JSONB().with_variant(JSON(), "sqlite"), nullable=True, default={}
    )
    record_count: Mapped[int] = Column(Integer, default=0)
    column_count: Mapped[int] = Column(Integer, default=0)
    quality_score: Mapped[float] = Column(Numeric(5, 2), default=0.00)
    status: Mapped[str] = Column(String(50), nullable=False, default="Empty")
    owner_id: Mapped[uuid.UUID | None] = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    is_deleted: Mapped[bool] = Column(Boolean, default=False, nullable=False)
    deleted_at: Mapped[datetime | None] = Column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = Column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = Column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Table arguments for Postgres constraints and indexes
    __table_args__ = (
        CheckConstraint(
            "quality_score >= 0.00 AND quality_score <= 100.00",
            name="quality_score_range",
        ),
        Index("idx_dataset_workspace_status", "workspace_id", "status"),
    )

    # Relationships
    workspace = relationship("Workspace", back_populates="datasets")
    pipelines = relationship("Pipeline", back_populates="dataset")

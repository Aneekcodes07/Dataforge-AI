"""
Datasets models — Datasets database mapping.
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Numeric, ForeignKey, DateTime, Boolean, CheckConstraint, Index, JSON
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from src.core.database import Base


class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), index=True, nullable=False)
    name = Column(String(255), nullable=False)
    source_type = Column(String(50), nullable=True)
    description = Column(String, nullable=True)
    s3_path = Column(String(512), nullable=True)
    schema_config = Column(JSONB().with_variant(JSON(), "sqlite"), nullable=True, default={})
    record_count = Column(Integer, default=0)
    column_count = Column(Integer, default=0)
    quality_score = Column(Numeric(5, 2), default=0.00)
    status = Column(String(50), nullable=False, default="Empty")
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True, nullable=True)
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Table arguments for Postgres constraints and indexes
    __table_args__ = (
        CheckConstraint("quality_score >= 0.00 AND quality_score <= 100.00", name="quality_score_range"),
        Index("idx_dataset_workspace_status", "workspace_id", "status"),
    )

    # Relationships
    workspace = relationship("Workspace", back_populates="datasets")
    pipelines = relationship("Pipeline", back_populates="dataset")

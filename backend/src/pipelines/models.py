"""
Pipelines models — Pipelines and execution runs database mapping.
"""

import uuid
from datetime import datetime
from sqlalchemy import (
    Column,
    String,
    Integer,
    ForeignKey,
    DateTime,
    Text,
    Boolean,
    CheckConstraint,
    Index,
    JSON,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship, Mapped
from src.core.database import Base


class Pipeline(Base):
    __tablename__ = "pipelines"

    id: Mapped[uuid.UUID] = Column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    workspace_id: Mapped[uuid.UUID] = Column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    dataset_id: Mapped[uuid.UUID | None] = Column(
        UUID(as_uuid=True),
        ForeignKey("datasets.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    name: Mapped[str] = Column(String(255), nullable=False)
    description: Mapped[str | None] = Column(String, nullable=True)
    status: Mapped[str] = Column(
        String(50), nullable=False, default="Idle"
    )  # 'Active', 'Paused', 'Idle'
    cron_schedule: Mapped[str | None] = Column(String(100), nullable=True)
    run_configuration: Mapped[dict | None] = Column(
        JSONB().with_variant(JSON(), "sqlite"), nullable=True, default={}
    )
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

    # Table arguments for composite index
    __table_args__ = (Index("idx_pipeline_workspace_status", "workspace_id", "status"),)

    # Relationships
    workspace = relationship("Workspace", back_populates="pipelines")
    dataset = relationship("Dataset", back_populates="pipelines")
    runs = relationship(
        "PipelineRun", back_populates="pipeline", cascade="all, delete-orphan"
    )


class PipelineRun(Base):
    __tablename__ = "pipeline_runs"

    id: Mapped[uuid.UUID] = Column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    pipeline_id: Mapped[uuid.UUID] = Column(
        UUID(as_uuid=True),
        ForeignKey("pipelines.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    status: Mapped[str] = Column(
        String(50), nullable=False, default="queued"
    )  # 'queued', 'running', 'completed', 'failed', 'cancelled'
    triggered_by: Mapped[uuid.UUID | None] = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    duration_seconds: Mapped[int] = Column(Integer, default=0)
    records_processed: Mapped[int] = Column(Integer, default=0)
    error_message: Mapped[str | None] = Column(Text, nullable=True)
    logs_path: Mapped[str | None] = Column(String(512), nullable=True)
    created_at: Mapped[datetime] = Column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    started_at: Mapped[datetime | None] = Column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = Column(
        DateTime(timezone=True), nullable=True
    )

    # Table arguments for constraints and composite index
    __table_args__ = (
        CheckConstraint("duration_seconds >= 0", name="duration_non_negative"),
        CheckConstraint("records_processed >= 0", name="records_non_negative"),
        Index(
            "idx_pipelinerun_pipeline_status_created",
            "pipeline_id",
            "status",
            "created_at",
        ),
    )

    # Relationships
    pipeline = relationship("Pipeline", back_populates="runs")
    agent_metrics = relationship(
        "AgentMetrics", back_populates="run", cascade="all, delete-orphan"
    )

"""
Monitoring models — Agent Metrics, Notifications, Activity Logs, and System Audit Events.
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
    Numeric,
    BigInteger,
    Boolean,
    CheckConstraint,
    Index,
    JSON,
    event,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship, Mapped
from src.core.database import Base


class AgentMetrics(Base):
    __tablename__ = "agent_metrics"

    id: Mapped[uuid.UUID] = Column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    run_id: Mapped[uuid.UUID] = Column(
        UUID(as_uuid=True),
        ForeignKey("pipeline_runs.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    agent_type: Mapped[str] = Column(
        String(50), nullable=False
    )  # 'OCR', 'Extraction', 'Validation', 'Cleaning', 'EDA', 'Export'
    status: Mapped[str] = Column(
        String(50), nullable=False, default="Idle"
    )  # 'Idle', 'Processing', 'Completed', 'Failed'
    throughput: Mapped[float] = Column(Numeric(12, 2), default=0.00)
    queue_size: Mapped[int] = Column(Integer, default=0)
    cpu_percentage: Mapped[float] = Column(Numeric(5, 2), default=0.00)
    memory_bytes: Mapped[int] = Column(BigInteger, default=0)
    runtime_seconds: Mapped[int] = Column(Integer, default=0)
    recorded_at: Mapped[datetime] = Column(
        DateTime(timezone=True), default=datetime.utcnow
    )

    # Table arguments for Postgres constraints
    __table_args__ = (
        CheckConstraint("throughput >= 0", name="throughput_non_negative"),
        CheckConstraint("queue_size >= 0", name="queue_size_non_negative"),
        CheckConstraint("runtime_seconds >= 0", name="runtime_seconds_non_negative"),
        CheckConstraint(
            "cpu_percentage >= 0.00 AND cpu_percentage <= 100.00",
            name="cpu_percentage_range",
        ),
    )

    # Relationships
    run = relationship("PipelineRun", back_populates="agent_metrics")


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = Column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    type: Mapped[str] = Column(
        String(50), nullable=False, default="info"
    )  # 'success', 'warning', 'error', 'info'
    title: Mapped[str] = Column(String(255), nullable=False)
    content: Mapped[str] = Column(Text, nullable=False)
    link: Mapped[str | None] = Column(String(255), nullable=True)
    is_read: Mapped[bool] = Column(Boolean, default=False)
    created_at: Mapped[datetime] = Column(
        DateTime(timezone=True), default=datetime.utcnow
    )

    # Table arguments for composite index
    __table_args__ = (
        Index("idx_notification_user_read_created", "user_id", "is_read", "created_at"),
    )


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id: Mapped[uuid.UUID] = Column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    workspace_id: Mapped[uuid.UUID] = Column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    user_id: Mapped[uuid.UUID | None] = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    event_type: Mapped[str] = Column(String(100), nullable=False)
    description: Mapped[str] = Column(Text, nullable=False)
    ip_address: Mapped[str | None] = Column(String(45), nullable=True)
    user_agent: Mapped[str | None] = Column(Text, nullable=True)
    created_at: Mapped[datetime] = Column(
        DateTime(timezone=True), default=datetime.utcnow
    )

    # Table arguments for composite index
    __table_args__ = (
        Index("idx_activitylog_workspace_created", "workspace_id", "created_at"),
    )

    # Relationships
    workspace = relationship("Workspace", back_populates="activity_logs")


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[uuid.UUID] = Column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    workspace_id: Mapped[uuid.UUID] = Column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    entity_type: Mapped[str] = Column(
        String(100), nullable=False
    )  # 'User', 'Pipeline', 'Dataset'
    entity_id: Mapped[uuid.UUID] = Column(UUID(as_uuid=True), nullable=False)
    action: Mapped[str] = Column(
        String(100), nullable=False
    )  # 'CREATE', 'UPDATE', 'DELETE'
    details: Mapped[dict | None] = Column(
        JSONB().with_variant(JSON(), "sqlite"), nullable=True, default={}
    )
    performer_id: Mapped[uuid.UUID | None] = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    ip_address: Mapped[str | None] = Column(String(45), nullable=True)
    created_at: Mapped[datetime] = Column(
        DateTime(timezone=True), default=datetime.utcnow
    )

    # Relationships
    workspace = relationship("Workspace", back_populates="audit_events")


# Event listeners to broadcast inserts in real-time via WebSockets
@event.listens_for(Notification, "after_insert")
def on_notification_insert(mapper, connection, target):
    try:
        from src.core.redis_pubsub import publish_ws_event

        payload = {
            "id": str(target.id),
            "userId": str(target.user_id),
            "type": target.type,
            "title": target.title,
            "message": target.content,  # map content to message for frontend
            "link": target.link,
            "read": target.is_read,
            "timestamp": target.created_at.isoformat() if target.created_at else None,
        }
        publish_ws_event(f"user:{target.user_id}", "notification.created", payload)
    except Exception:
        pass


@event.listens_for(ActivityLog, "after_insert")
def on_activity_insert(mapper, connection, target):
    try:
        from src.core.redis_pubsub import publish_ws_event

        payload = {
            "id": str(target.id),
            "workspaceId": str(target.workspace_id),
            "userId": str(target.user_id) if target.user_id else None,
            "type": target.event_type.lower()
            if hasattr(target, "event_type")
            else "extraction",
            "message": target.description,
            "timestamp": target.created_at.isoformat() if target.created_at else None,
        }
        publish_ws_event(
            f"workspace:{target.workspace_id}", "activity.created", payload
        )
    except Exception:
        pass

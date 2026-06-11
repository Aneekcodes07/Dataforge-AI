"""
Monitoring models — Agent Metrics, Notifications, Activity Logs, and System Audit Events.
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, ForeignKey, DateTime, Text, Numeric, BigInteger, Boolean, CheckConstraint, Index, JSON
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from src.core.database import Base


class AgentMetrics(Base):
    __tablename__ = "agent_metrics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id = Column(UUID(as_uuid=True), ForeignKey("pipeline_runs.id", ondelete="CASCADE"), index=True, nullable=False)
    agent_type = Column(String(50), nullable=False) # 'OCR', 'Extraction', 'Validation', 'Cleaning', 'EDA', 'Export'
    status = Column(String(50), nullable=False, default="Idle") # 'Idle', 'Processing', 'Completed', 'Failed'
    throughput = Column(Numeric(12, 2), default=0.00)
    queue_size = Column(Integer, default=0)
    cpu_percentage = Column(Numeric(5, 2), default=0.00)
    memory_bytes = Column(BigInteger, default=0)
    runtime_seconds = Column(Integer, default=0)
    recorded_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    # Table arguments for Postgres constraints
    __table_args__ = (
        CheckConstraint("throughput >= 0", name="throughput_non_negative"),
        CheckConstraint("queue_size >= 0", name="queue_size_non_negative"),
        CheckConstraint("runtime_seconds >= 0", name="runtime_seconds_non_negative"),
        CheckConstraint("cpu_percentage >= 0.00 AND cpu_percentage <= 100.00", name="cpu_percentage_range"),
    )

    # Relationships
    run = relationship("PipelineRun", back_populates="agent_metrics")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    type = Column(String(50), nullable=False, default="info") # 'success', 'warning', 'error', 'info'
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    link = Column(String(255), nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    # Table arguments for composite index
    __table_args__ = (
        Index("idx_notification_user_read_created", "user_id", "is_read", "created_at"),
    )


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), index=True, nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    event_type = Column(String(100), nullable=False)
    description = Column(Text, nullable=False)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    # Table arguments for composite index
    __table_args__ = (
        Index("idx_activitylog_workspace_created", "workspace_id", "created_at"),
    )

    # Relationships
    workspace = relationship("Workspace", back_populates="activity_logs")


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), index=True, nullable=False)
    entity_type = Column(String(100), nullable=False) # 'User', 'Pipeline', 'Dataset'
    entity_id = Column(UUID(as_uuid=True), nullable=False)
    action = Column(String(100), nullable=False) # 'CREATE', 'UPDATE', 'DELETE'
    details = Column(JSONB().with_variant(JSON(), "sqlite"), nullable=True, default={})
    performer_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    ip_address = Column(String(45), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    workspace = relationship("Workspace", back_populates="audit_events")


# Event listeners to broadcast inserts in real-time via WebSockets
from sqlalchemy import event

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
            "timestamp": target.created_at.isoformat() if target.created_at else None
        }
        publish_ws_event(f"user:{target.user_id}", "notification.created", payload)
    except Exception as e:
        pass


@event.listens_for(ActivityLog, "after_insert")
def on_activity_insert(mapper, connection, target):
    try:
        from src.core.redis_pubsub import publish_ws_event
        payload = {
            "id": str(target.id),
            "workspaceId": str(target.workspace_id),
            "userId": str(target.user_id) if target.user_id else None,
            "type": target.event_type.lower() if hasattr(target, 'event_type') else "extraction",
            "message": target.description,
            "timestamp": target.created_at.isoformat() if target.created_at else None
        }
        publish_ws_event(f"workspace:{target.workspace_id}", "activity.created", payload)
    except Exception as e:
        pass


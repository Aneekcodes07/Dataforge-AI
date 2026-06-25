"""AI persistence models — LLM usage/cost ledger."""

import uuid
from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped

from src.core.database import Base


class LLMUsageEvent(Base):
    """One row per LLM call (success or failure) for usage and cost tracking."""

    __tablename__ = "llm_usage_events"

    id: Mapped[uuid.UUID] = Column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    workspace_id: Mapped[uuid.UUID | None] = Column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="SET NULL"),
        nullable=True,
    )
    user_id: Mapped[uuid.UUID | None] = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    feature: Mapped[str] = Column(String(50), nullable=False)
    provider: Mapped[str] = Column(String(50), nullable=False)
    model: Mapped[str] = Column(String(100), nullable=False)
    prompt_tokens: Mapped[int] = Column(Integer, nullable=False, default=0)
    completion_tokens: Mapped[int] = Column(Integer, nullable=False, default=0)
    total_tokens: Mapped[int] = Column(Integer, nullable=False, default=0)
    cost_usd: Mapped[float] = Column(Numeric(12, 6), nullable=False, default=0)
    latency_ms: Mapped[int] = Column(Integer, nullable=False, default=0)
    status: Mapped[str] = Column(String(20), nullable=False, default="ok")
    run_id: Mapped[uuid.UUID | None] = Column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = Column(
        DateTime(timezone=True), default=datetime.utcnow
    )

    __table_args__ = (
        Index("idx_llm_usage_workspace_created", "workspace_id", "created_at"),
    )

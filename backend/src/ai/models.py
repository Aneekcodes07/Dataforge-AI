"""AI persistence models — LLM usage ledger and RAG document chunks."""

import uuid
from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped

from src.core.database import Base

# Embedding dimension for the configured embedding model (text-embedding-3-small).
# Changing this requires a new migration that recreates the embedding column.
EMBED_DIM = 1536

try:  # pragma: no cover - depends on environment
    from pgvector.sqlalchemy import Vector

    _EMBEDDING_TYPE = Vector(EMBED_DIM)
except Exception:  # noqa: BLE001 - pgvector optional outside prod/CI
    from sqlalchemy import LargeBinary

    _EMBEDDING_TYPE = LargeBinary()


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


class DocumentChunk(Base):
    """An embedded chunk of a dataset/document used for semantic retrieval."""

    __tablename__ = "document_chunks"

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
        ForeignKey("datasets.id", ondelete="CASCADE"),
        index=True,
        nullable=True,
    )
    source_file_id: Mapped[uuid.UUID | None] = Column(
        UUID(as_uuid=True),
        ForeignKey("source_files.id", ondelete="SET NULL"),
        nullable=True,
    )
    chunk_index: Mapped[int] = Column(Integer, nullable=False, default=0)
    content: Mapped[str] = Column(Text, nullable=False)
    embedding = Column(_EMBEDDING_TYPE, nullable=True)
    # Mapped to column "metadata"; the attribute is renamed to avoid clashing
    # with SQLAlchemy's reserved Declarative ``metadata`` attribute.
    extra_metadata: Mapped[dict | None] = Column(
        "metadata", JSONB().with_variant(JSON(), "sqlite"), nullable=True, default=dict
    )
    token_count: Mapped[int] = Column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = Column(
        DateTime(timezone=True), default=datetime.utcnow
    )

    __table_args__ = (
        Index("idx_document_chunks_workspace_dataset", "workspace_id", "dataset_id"),
    )

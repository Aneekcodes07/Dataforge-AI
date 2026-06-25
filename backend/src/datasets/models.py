"""
Datasets models — Datasets database mapping.
"""

import uuid
from datetime import datetime
from sqlalchemy import (
    Column,
    String,
    Integer,
    BigInteger,
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
    source_files = relationship(
        "SourceFile", back_populates="dataset", cascade="all, delete-orphan"
    )
    artifacts = relationship(
        "DataArtifact", back_populates="dataset", cascade="all, delete-orphan"
    )
    columns = relationship(
        "DatasetColumn", back_populates="dataset", cascade="all, delete-orphan"
    )


class SourceFile(Base):
    """A raw file uploaded for a dataset and stored in object storage."""

    __tablename__ = "source_files"

    id: Mapped[uuid.UUID] = Column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    workspace_id: Mapped[uuid.UUID] = Column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    dataset_id: Mapped[uuid.UUID] = Column(
        UUID(as_uuid=True),
        ForeignKey("datasets.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    original_filename: Mapped[str] = Column(String(512), nullable=False)
    content_type: Mapped[str | None] = Column(String(255), nullable=True)
    size_bytes: Mapped[int] = Column(BigInteger, nullable=False, default=0)
    storage_key: Mapped[str] = Column(String(1024), nullable=False)
    checksum_sha256: Mapped[str | None] = Column(String(64), nullable=True)
    status: Mapped[str] = Column(String(50), nullable=False, default="stored")
    created_at: Mapped[datetime] = Column(
        DateTime(timezone=True), default=datetime.utcnow
    )

    __table_args__ = (
        CheckConstraint("size_bytes >= 0", name="source_file_size_non_negative"),
    )

    dataset = relationship("Dataset", back_populates="source_files")


class DataArtifact(Base):
    """A materialized extracted dataset (e.g. Parquet) in object storage."""

    __tablename__ = "data_artifacts"

    id: Mapped[uuid.UUID] = Column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    dataset_id: Mapped[uuid.UUID] = Column(
        UUID(as_uuid=True),
        ForeignKey("datasets.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    run_id: Mapped[uuid.UUID | None] = Column(
        UUID(as_uuid=True),
        ForeignKey("pipeline_runs.id", ondelete="SET NULL"),
        nullable=True,
    )
    storage_key: Mapped[str] = Column(String(1024), nullable=False)
    format: Mapped[str] = Column(String(20), nullable=False, default="parquet")
    row_count: Mapped[int] = Column(Integer, nullable=False, default=0)
    column_count: Mapped[int] = Column(Integer, nullable=False, default=0)
    byte_size: Mapped[int] = Column(BigInteger, nullable=False, default=0)
    created_at: Mapped[datetime] = Column(
        DateTime(timezone=True), default=datetime.utcnow
    )

    __table_args__ = (
        CheckConstraint("row_count >= 0", name="artifact_rows_non_negative"),
    )

    dataset = relationship("Dataset", back_populates="artifacts")


class DatasetColumn(Base):
    """Per-column profile for a dataset, powering the schema/quality UI."""

    __tablename__ = "dataset_columns"

    id: Mapped[uuid.UUID] = Column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    dataset_id: Mapped[uuid.UUID] = Column(
        UUID(as_uuid=True),
        ForeignKey("datasets.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    name: Mapped[str] = Column(String(255), nullable=False)
    dtype: Mapped[str] = Column(String(50), nullable=False, default="string")
    null_rate: Mapped[float] = Column(Numeric(5, 2), nullable=False, default=0)
    unique_count: Mapped[int] = Column(Integer, nullable=False, default=0)
    sample_values: Mapped[dict | None] = Column(
        JSONB().with_variant(JSON(), "sqlite"), nullable=True, default=list
    )
    status: Mapped[str] = Column(String(20), nullable=False, default="valid")
    created_at: Mapped[datetime] = Column(
        DateTime(timezone=True), default=datetime.utcnow
    )

    dataset = relationship("Dataset", back_populates="columns")

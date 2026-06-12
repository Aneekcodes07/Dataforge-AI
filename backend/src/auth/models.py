"""
Auth models — Users, Workspaces, Teams, API Keys, and Copilot Sessions database mapping.
"""

import uuid
import enum
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Table, Text, JSON
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship, Mapped
from src.core.database import Base


class UserRole(str, enum.Enum):
    Owner = "Owner"
    Admin = "Admin"
    Editor = "Editor"
    Viewer = "Viewer"


class ChatSender(str, enum.Enum):
    user = "user"
    ai = "ai"


# Association table for Workspace Membership (RBAC mapping)
class WorkspaceMembership(Base):
    __tablename__ = "workspace_memberships"

    workspace_id: Mapped[uuid.UUID] = Column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        primary_key=True,
    )
    user_id: Mapped[uuid.UUID] = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    role: Mapped[str] = Column(
        String(50), nullable=False, default="Viewer"
    )  # String to avoid complex enum casting
    created_at: Mapped[datetime] = Column(
        DateTime(timezone=True), default=datetime.utcnow
    )

    # Relationships
    workspace = relationship("Workspace", back_populates="memberships")
    user = relationship("User", back_populates="memberships")


# Association table for Team Memberships
team_memberships = Table(
    "team_memberships",
    Base.metadata,
    Column(
        "team_id",
        UUID(as_uuid=True),
        ForeignKey("teams.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "user_id",
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column("created_at", DateTime(timezone=True), default=datetime.utcnow),
)


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = Column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = Column(String(255), nullable=False)
    name: Mapped[str] = Column(String(255), nullable=False)
    email_verified: Mapped[bool] = Column(Boolean, default=False)
    verification_token: Mapped[str | None] = Column(String(255), nullable=True)
    password_reset_token: Mapped[str | None] = Column(String(255), nullable=True)
    is_deleted: Mapped[bool] = Column(Boolean, default=False, nullable=False)
    deleted_at: Mapped[datetime | None] = Column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = Column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = Column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    memberships = relationship(
        "WorkspaceMembership", back_populates="user", cascade="all, delete-orphan"
    )
    teams = relationship("Team", secondary=team_memberships, back_populates="members")
    api_keys = relationship("APIKey", back_populates="owner")
    copilot_sessions = relationship(
        "CopilotSession", back_populates="user", cascade="all, delete-orphan"
    )


class Workspace(Base):
    __tablename__ = "workspaces"

    id: Mapped[uuid.UUID] = Column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = Column(String(255), nullable=False)
    is_deleted: Mapped[bool] = Column(Boolean, default=False, nullable=False)
    deleted_at: Mapped[datetime | None] = Column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = Column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = Column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    memberships = relationship(
        "WorkspaceMembership", back_populates="workspace", cascade="all, delete-orphan"
    )
    teams = relationship(
        "Team", back_populates="workspace", cascade="all, delete-orphan"
    )
    datasets = relationship(
        "Dataset", back_populates="workspace", cascade="all, delete-orphan"
    )
    pipelines = relationship(
        "Pipeline", back_populates="workspace", cascade="all, delete-orphan"
    )
    activity_logs = relationship(
        "ActivityLog", back_populates="workspace", cascade="all, delete-orphan"
    )
    api_keys = relationship(
        "APIKey", back_populates="workspace", cascade="all, delete-orphan"
    )
    audit_events = relationship(
        "AuditEvent", back_populates="workspace", cascade="all, delete-orphan"
    )


class Team(Base):
    __tablename__ = "teams"

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
    created_at: Mapped[datetime] = Column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = Column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    workspace = relationship("Workspace", back_populates="teams")
    members = relationship("User", secondary=team_memberships, back_populates="teams")


class APIKey(Base):
    __tablename__ = "api_keys"

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
    hashed_key: Mapped[str] = Column(
        String(255), unique=True, index=True, nullable=False
    )
    prefix: Mapped[str] = Column(String(16), nullable=False)
    is_active: Mapped[bool] = Column(Boolean, default=True)
    owner_id: Mapped[uuid.UUID | None] = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    expires_at: Mapped[datetime | None] = Column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = Column(
        DateTime(timezone=True), default=datetime.utcnow
    )

    # Relationships
    workspace = relationship("Workspace", back_populates="api_keys")
    owner = relationship("User", back_populates="api_keys")


class CopilotSession(Base):
    __tablename__ = "copilot_sessions"

    id: Mapped[uuid.UUID] = Column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    title: Mapped[str] = Column(String(255), nullable=False, default="New Conversation")
    created_at: Mapped[datetime] = Column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = Column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    user = relationship("User", back_populates="copilot_sessions")
    messages = relationship(
        "CopilotMessage", back_populates="session", cascade="all, delete-orphan"
    )


class CopilotMessage(Base):
    __tablename__ = "copilot_messages"

    id: Mapped[uuid.UUID] = Column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = Column(
        UUID(as_uuid=True),
        ForeignKey("copilot_sessions.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    sender: Mapped[str] = Column(String(50), nullable=False)  # 'user' or 'ai'
    text: Mapped[str] = Column(Text, nullable=False)
    card_type: Mapped[str | None] = Column(String(50), nullable=True)
    card_data: Mapped[dict | None] = Column(
        JSONB().with_variant(JSON(), "sqlite"), nullable=True, default={}
    )
    created_at: Mapped[datetime] = Column(
        DateTime(timezone=True), default=datetime.utcnow
    )

    # Relationships
    session = relationship("CopilotSession", back_populates="messages")

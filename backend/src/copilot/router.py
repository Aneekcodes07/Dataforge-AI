"""
Copilot router — chat sessions, message histories, and LLM query endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, status, WebSocket
from sqlalchemy.orm import Session
from datetime import datetime
import uuid

from src.core.database import get_db
from src.core.config import get_settings
from src.auth.router import get_current_user
from src.auth.models import User, CopilotSession, CopilotMessage, WorkspaceMembership
from src.ai.llm import ProviderNotConfiguredError, get_gateway
from src.ai.rag import get_vector_store
from src.copilot.service import CopilotService
from src.copilot.schemas import (
    CopilotSessionResponse,
    CopilotMessageResponse,
    CopilotSessionCreate,
    CopilotQueryRequest,
)

settings = get_settings()
router = APIRouter()


@router.get("/sessions", response_model=list[CopilotSessionResponse])
def list_sessions(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """List all copilot conversation sessions for current user."""
    sessions = (
        db.query(CopilotSession)
        .filter(CopilotSession.user_id == current_user.id)
        .order_by(CopilotSession.updated_at.desc())
        .all()
    )

    return [
        CopilotSessionResponse(
            id=str(s.id),
            user_id=str(s.user_id),
            title=s.title,
            created_at=s.created_at,
            updated_at=s.updated_at,
        )
        for s in sessions
    ]


@router.post(
    "/sessions",
    response_model=CopilotSessionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_session(
    payload: CopilotSessionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Initialize a new copilot conversation session."""
    session = CopilotSession(
        user_id=current_user.id,
        title=payload.title,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return CopilotSessionResponse(
        id=str(session.id),
        user_id=str(session.user_id),
        title=session.title,
        created_at=session.created_at,
        updated_at=session.updated_at,
    )


@router.get(
    "/sessions/{session_id}/messages", response_model=list[CopilotMessageResponse]
)
def list_messages(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the message feed inside an active conversation session."""
    try:
        session_uuid = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid session ID format",
        )

    session = (
        db.query(CopilotSession)
        .filter(
            CopilotSession.id == session_uuid, CopilotSession.user_id == current_user.id
        )
        .first()
    )

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    messages = (
        db.query(CopilotMessage)
        .filter(CopilotMessage.session_id == session.id)
        .order_by(CopilotMessage.created_at.asc())
        .all()
    )

    return [
        CopilotMessageResponse(
            id=str(m.id),
            session_id=str(m.session_id),
            sender=m.sender,
            text=m.text,
            card_type=m.card_type,
            card_data=m.card_data or {},
            created_at=m.created_at,
        )
        for m in messages
    ]


@router.post("/sessions/{session_id}/query", response_model=CopilotMessageResponse)
def submit_query(
    session_id: str,
    payload: CopilotQueryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Process prompt query and save dialogue response in conversation history."""
    try:
        session_uuid = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid session ID format",
        )

    session = (
        db.query(CopilotSession)
        .filter(
            CopilotSession.id == session_uuid, CopilotSession.user_id == current_user.id
        )
        .first()
    )

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    # 1. Save User Message
    user_msg = CopilotMessage(
        session_id=session.id,
        sender="user",
        text=payload.text,
    )
    db.add(user_msg)

    # 2. Generate a grounded response via the Copilot service.
    membership = (
        db.query(WorkspaceMembership)
        .filter(WorkspaceMembership.user_id == current_user.id)
        .first()
    )
    workspace_id = str(membership.workspace_id) if membership else None
    try:
        gateway = get_gateway()
    except ProviderNotConfiguredError:
        gateway = None
    vector_store = get_vector_store() if gateway else None
    service = CopilotService(db, gateway, vector_store)
    text, card_type, card_data = service.complete(
        workspace_id, payload.text, str(current_user.id)
    )

    # 3. Save AI Message
    ai_msg = CopilotMessage(
        session_id=session.id,
        sender="ai",
        text=text,
        card_type=card_type,
        card_data=card_data,
    )
    db.add(ai_msg)

    # Update session updated_at
    session.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(ai_msg)

    return CopilotMessageResponse(
        id=str(ai_msg.id),
        session_id=str(ai_msg.session_id),
        sender=ai_msg.sender,
        text=ai_msg.text,
        card_type=ai_msg.card_type,
        card_data=ai_msg.card_data or {},
        created_at=ai_msg.created_at,
    )


async def handle_copilot_stream(
    user_id: str, workspace_id: str, session_id: str, query: str, websocket: WebSocket
):
    """Enqueue prompt query execution in background Celery worker."""
    from src.copilot.tasks import run_copilot_query_task

    run_copilot_query_task.delay(user_id, workspace_id, session_id, query)

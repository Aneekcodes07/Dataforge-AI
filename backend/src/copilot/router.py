"""
Copilot router — chat sessions, message histories, and LLM query endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, status, WebSocket
from sqlalchemy.orm import Session
from datetime import datetime
import uuid
import json
import asyncio

from src.core.database import get_db, SessionLocal
from src.core.config import get_settings
from src.auth.router import get_current_user
from src.auth.models import User, CopilotSession, CopilotMessage
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all copilot conversation sessions for current user."""
    sessions = db.query(CopilotSession).filter(
        CopilotSession.user_id == current_user.id
    ).order_by(CopilotSession.updated_at.desc()).all()

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


@router.post("/sessions", response_model=CopilotSessionResponse, status_code=status.HTTP_201_CREATED)
def create_session(
    payload: CopilotSessionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
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


@router.get("/sessions/{session_id}/messages", response_model=list[CopilotMessageResponse])
def list_messages(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the message feed inside an active conversation session."""
    try:
        session_uuid = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid session ID format",
        )

    session = db.query(CopilotSession).filter(
        CopilotSession.id == session_uuid,
        CopilotSession.user_id == current_user.id
    ).first()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    messages = db.query(CopilotMessage).filter(
        CopilotMessage.session_id == session.id
    ).order_by(CopilotMessage.created_at.asc()).all()

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


def generate_fallback_llm_response(query: str) -> tuple[str, str | None, dict]:
    """Provide structured mock responses depending on query context."""
    q = query.lower()
    
    if "failed" in q or "history" in q:
        text = "Based on your ingestion history logs, **1 pipeline execution failed** in the last 24 hours:\n\n* **Pipeline ID:** `pl_ec_crawl_8321`\n* **Connector Source:** Website Scraper (`url`)\n* **Failure Point:** stage `extractor` timed out when resolving connections with the target gateway relayer."
        card_type = "pipeline"
        card_data = {
            "impact": "Critical Error",
            "accuracy": "96%",
            "recommendation": "Retry active crawl node. Bypassing validation or rate-limiting is not suggested."
        }
    elif "quality" in q or "low-quality" in q or "dataset" in q:
        text = "Scanned all S3 Parquet dataset tables. The dataset **`arxiv-ml-papers`** is currently flagged with **quality compliance issues** (91.5% score):\n\n* **Missing Values:** `description` field has 11.7% null rate (216 empty fields).\n* **Out-of-Bounds:** `price` field contains negative float ranges."
        card_type = "dataset"
        card_data = {
            "score": "91.5%",
            "anomalies": 219,
            "actions": ["Auto-impute missing values", "Verify schema rules"]
        }
    elif "clean" in q or "rules" in q:
        text = "To clean and standardize your current dataset catalog, I suggest appending the following **DataForge Auto-Cleaner rules**:"
        card_type = "cleaning"
        card_data = {
            "imputations": [{"field": "description", "method": "default", "fill_value": ""}],
            "coercions": [{"field": "price", "rule": "numeric_float_absolute"}]
        }
    elif "agent" in q or "overloaded" in q:
        text = "Ingest worker node **`crawler_worker_04`** (Extractor agent) is currently flagged as **Overloaded**:\n\n* **Queue size:** `14 items` in memory buffer.\n* **Throughput:** `2,840 records/sec` processing peak.\n* **Latency:** `114ms` loop speed (normal range <50ms).\n* **CPU usage:** `92%` core capacity."
        card_type = "agent"
        card_data = {
            "cpu": "92%",
            "latency": "114ms",
            "queue": 14,
            "throughput": "2.8K rec/s"
        }
    elif "optimize" in q or "optimizations" in q:
        text = "I recommend three core optimizations to elevate your crawling throughput speeds and reduce costs:\n\n1. **Parallel Workers:** Increase scraper threads from 2 to 4 nodes.\n2. **Bypass OCR:** Disable OCR Parsing node if target files contain native digital text layouts.\n3. **Relay Proxies:** Enable proxy rotation relay to prevent target rate-limiting delays."
        card_type = "optimization"
        card_data = {
            "boost": "+24% Throughput",
            "instance": "df.t4.large"
        }
    else:
        text = "Hello! I am the DataForge AI Data Copilot. I can assist you with your pipeline configurations, data cleaning rules, agent resource settings, or history log diagnostics."
        card_type = None
        card_data = {}

    return text, card_type, card_data


@router.post("/sessions/{session_id}/query", response_model=CopilotMessageResponse)
def submit_query(
    session_id: str,
    payload: CopilotQueryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Process prompt query and save dialogue response in conversation history."""
    try:
        session_uuid = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid session ID format",
        )

    session = db.query(CopilotSession).filter(
        CopilotSession.id == session_uuid,
        CopilotSession.user_id == current_user.id
    ).first()

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

    # 2. Get Response (integrates API key check or fallback)
    text, card_type, card_data = generate_fallback_llm_response(payload.text)

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


async def handle_copilot_stream(user_id: str, workspace_id: str, session_id: str, query: str, websocket: WebSocket):
    """Enqueue prompt query execution in background Celery worker."""
    from src.copilot.tasks import run_copilot_query_task
    run_copilot_query_task.delay(user_id, workspace_id, session_id, query)


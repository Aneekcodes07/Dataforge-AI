"""
Celery task definitions for Copilot LLM queries.
"""

import time
import uuid
import logging
from datetime import datetime
from src.celery_app import celery_app
from src.core.database import SessionLocal
from src.core.redis_pubsub import publish_ws_event
from src.auth.models import CopilotSession, CopilotMessage
from src.copilot.router import generate_fallback_llm_response

logger = logging.getLogger(__name__)


@celery_app.task(name="run_copilot_query_task", bind=True, max_retries=3)
def run_copilot_query_task(self, user_id: str, workspace_id: str, session_id: str, query: str):
    """Processes Copilot LLM query in worker, saves dialogue to database, and streams token frames via Pub/Sub."""
    logger.info(f"Running Copilot query task for session: {session_id}, user: {user_id}")
    db = SessionLocal()
    try:
        session_uuid = uuid.UUID(session_id)
        user_uuid = uuid.UUID(user_id)

        session = db.query(CopilotSession).filter(
            CopilotSession.id == session_uuid,
            CopilotSession.user_id == user_uuid
        ).first()

        if not session:
            publish_ws_event(
                room=f"user:{user_id}",
                event_type="copilot.streaming",
                payload={"error": "Session not found", "done": True}
            )
            return {"status": "failed", "error": "Session not found"}

        # 1. Save User Message
        user_msg = CopilotMessage(
            session_id=session.id,
            sender="user",
            text=query,
        )
        db.add(user_msg)

        # 2. Get LLM response mapping
        text, card_type, card_data = generate_fallback_llm_response(query)

        # 3. Save AI Message
        ai_msg = CopilotMessage(
            session_id=session.id,
            sender="ai",
            text=text,
            card_type=card_type,
            card_data=card_data,
        )
        db.add(ai_msg)

        # Update session timestamp
        session.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(ai_msg)

        # 4. Stream response progressively word-by-word
        words = text.split(" ")
        current_text = ""

        for i, word in enumerate(words):
            current_text += (" " if i > 0 else "") + word
            publish_ws_event(
                room=f"user:{user_id}",
                event_type="copilot.streaming",
                payload={
                    "messageId": str(ai_msg.id),
                    "sessionId": session_id,
                    "text": current_text,
                    "done": False,
                    "cardType": card_type,
                    "cardData": card_data
                }
            )
            time.sleep(0.04)

        # 5. Finalize broadcast frame
        publish_ws_event(
            room=f"user:{user_id}",
            event_type="copilot.streaming",
            payload={
                "messageId": str(ai_msg.id),
                "sessionId": session_id,
                "text": text,
                "done": True,
                "cardType": card_type,
                "cardData": card_data
            }
        )

        return {"status": "success", "message_id": str(ai_msg.id)}

    except Exception as exc:
        db.rollback()
        logger.error(f"Copilot background task failure: {exc}")
        publish_ws_event(
            room=f"user:{user_id}",
            event_type="copilot.streaming",
            payload={"error": str(exc), "done": True}
        )
        raise self.retry(exc=exc, countdown=5)
    finally:
        db.close()

"""Celery task for Copilot queries — real RAG-grounded streaming."""

import logging
import uuid
from datetime import datetime, timezone

from src.ai.llm import ProviderNotConfiguredError, ROLE_SMART, get_gateway
from src.ai.rag import get_vector_store
from src.auth.models import CopilotMessage, CopilotSession
from src.celery_app import celery_app
from src.copilot.service import CopilotService
from src.core.database import SessionLocal
from src.core.redis_pubsub import publish_ws_event

logger = logging.getLogger(__name__)


def _publish(user_id: str, payload: dict) -> None:
    publish_ws_event(
        room=f"user:{user_id}", event_type="copilot.streaming", payload=payload
    )


@celery_app.task(name="run_copilot_query_task", bind=True, max_retries=3)
def run_copilot_query_task(
    self, user_id: str, workspace_id: str, session_id: str, query: str
):
    """Run a Copilot query: ground it in workspace data + RAG, stream the answer."""
    logger.info("Running Copilot query for session %s", session_id)
    db = SessionLocal()
    try:
        session = (
            db.query(CopilotSession)
            .filter(
                CopilotSession.id == uuid.UUID(session_id),
                CopilotSession.user_id == uuid.UUID(user_id),
            )
            .first()
        )
        if not session:
            _publish(user_id, {"error": "Session not found", "done": True})
            return {"status": "failed", "error": "Session not found"}

        db.add(CopilotMessage(session_id=session.id, sender="user", text=query))

        try:
            gateway = get_gateway()
        except ProviderNotConfiguredError:
            gateway = None

        # Soft cost guard: if the workspace is over its monthly AI budget, degrade
        # to factual (DB-derived) answers instead of making paid LLM calls.
        if gateway is not None:
            from src.ai.quota import check_quota
            from src.core.config import get_settings

            cap = get_settings().LLM_MONTHLY_COST_CAP_USD
            if not check_quota(db, workspace_id, cap):
                logger.warning(
                    "Workspace %s over monthly AI budget; Copilot using fallback",
                    workspace_id,
                )
                gateway = None

        vector_store = get_vector_store() if gateway else None

        service = CopilotService(db, gateway, vector_store)
        context = service.prepare(workspace_id, query)

        ai_msg = CopilotMessage(
            session_id=session.id,
            sender="ai",
            text="",
            card_type=context.card_type,
            card_data=context.card_data,
        )
        db.add(ai_msg)
        db.commit()
        db.refresh(ai_msg)
        message_id = str(ai_msg.id)

        full_text = ""
        if gateway is not None:
            try:
                for chunk in gateway.stream(
                    context.messages,
                    role=ROLE_SMART,
                    feature="copilot",
                    workspace_id=workspace_id,
                    user_id=user_id,
                ):
                    if chunk.delta:
                        full_text += chunk.delta
                        _publish(
                            user_id,
                            {
                                "messageId": message_id,
                                "sessionId": session_id,
                                "text": full_text,
                                "done": False,
                                "cardType": context.card_type,
                                "cardData": context.card_data,
                            },
                        )
            except Exception as exc:  # noqa: BLE001 - degrade to factual fallback
                logger.warning("Copilot streaming failed: %s", exc)

        if not full_text.strip():
            full_text = context.fallback_text

        ai_msg.text = full_text
        session.updated_at = datetime.now(timezone.utc)
        db.commit()

        _publish(
            user_id,
            {
                "messageId": message_id,
                "sessionId": session_id,
                "text": full_text,
                "done": True,
                "cardType": context.card_type,
                "cardData": context.card_data,
            },
        )
        return {"status": "success", "message_id": message_id}

    except Exception as exc:  # noqa: BLE001
        db.rollback()
        logger.error("Copilot task failed: %s", exc)
        _publish(user_id, {"error": str(exc), "done": True})
        raise self.retry(exc=exc, countdown=5)
    finally:
        db.close()

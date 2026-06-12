"""
Celery task definitions for System Monitoring and Notification events.
"""

import uuid
import logging
from src.celery_app import celery_app
from src.core.database import SessionLocal
from src.monitoring.models import Notification, ActivityLog

logger = logging.getLogger(__name__)


@celery_app.task(name="process_notification_task", bind=True, max_retries=3)
def process_notification_task(
    self,
    user_id: str,
    title: str,
    content: str,
    notif_type: str = "info",
    link: str | None = None,
):
    """Processes system notification creation in background."""
    logger.info(f"Processing notification for user: {user_id}")
    db = SessionLocal()
    try:
        notification = Notification(
            user_id=uuid.UUID(user_id),
            type=notif_type,
            title=title,
            content=content,
            link=link,
            is_read=False,
        )
        db.add(notification)
        db.commit()
        db.refresh(notification)
        return {"status": "success", "notification_id": str(notification.id)}
    except Exception as exc:
        db.rollback()
        logger.error(f"Failed to process notification background task: {exc}")
        raise self.retry(exc=exc, countdown=5)
    finally:
        db.close()


@celery_app.task(name="log_activity_task", bind=True, max_retries=3)
def log_activity_task(
    self,
    workspace_id: str,
    event_type: str,
    description: str,
    user_id: str | None = None,
):
    """Saves and dispatches system activity events in background."""
    logger.info(f"Logging activity feed event for workspace: {workspace_id}")
    db = SessionLocal()
    try:
        activity = ActivityLog(
            workspace_id=uuid.UUID(workspace_id),
            user_id=uuid.UUID(user_id) if user_id else None,
            event_type=event_type,
            description=description,
        )
        db.add(activity)
        db.commit()
        db.refresh(activity)
        return {"status": "success", "activity_id": str(activity.id)}
    except Exception as exc:
        db.rollback()
        logger.error(f"Failed to log activity event: {exc}")
        raise self.retry(exc=exc, countdown=5)
    finally:
        db.close()


@celery_app.task(name="celery_health_check")
def celery_health_check():
    """Simple ping-pong task verifying worker responsiveness."""
    logger.info("Executing Celery health check task...")
    return {"status": "ok", "timestamp": str(uuid.uuid4())}

"""
Monitoring router — user notifications and system audit log endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import uuid

from src.core.database import get_db
from src.auth.router import get_current_user
from src.auth.models import User, WorkspaceMembership
from src.monitoring.models import Notification, ActivityLog
from src.monitoring.schemas import NotificationResponse, ActivityLogResponse

router = APIRouter()


@router.get("/notifications", response_model=list[NotificationResponse])
def list_notifications(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Retrieve all notifications for the authenticated user."""
    notifications = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .all()
    )

    return [
        NotificationResponse(
            id=str(n.id),
            user_id=str(n.user_id),
            type=n.type,
            title=n.title,
            content=n.content,
            link=n.link,
            is_read=n.is_read,
            created_at=n.created_at,
        )
        for n in notifications
    ]


@router.post(
    "/notifications/{notification_id}/read", response_model=NotificationResponse
)
def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Toggle the read state of a notification."""
    try:
        notification_uuid = uuid.UUID(notification_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid notification ID format",
        )

    notification = (
        db.query(Notification)
        .filter(
            Notification.id == notification_uuid,
            Notification.user_id == current_user.id,
        )
        .first()
    )

    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )

    notification.is_read = True
    db.commit()
    db.refresh(notification)

    # Broadcast read update to user via Redis Pub/Sub
    try:
        from src.core.redis_pubsub import publish_ws_event

        publish_ws_event(
            room=f"user:{current_user.id}",
            event_type="notification.read",
            payload={"id": str(notification.id), "read": True},
        )
    except Exception:
        pass

    return NotificationResponse(
        id=str(notification.id),
        user_id=str(notification.user_id),
        type=notification.type,
        title=notification.title,
        content=notification.content,
        link=notification.link,
        is_read=notification.is_read,
        created_at=notification.created_at,
    )


@router.get("/activities", response_model=list[ActivityLogResponse])
def list_activities(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """List activity logs within user's active workspace."""
    membership = (
        db.query(WorkspaceMembership)
        .filter(WorkspaceMembership.user_id == current_user.id)
        .first()
    )
    if not membership:
        return []

    logs = (
        db.query(ActivityLog)
        .filter(ActivityLog.workspace_id == membership.workspace_id)
        .order_by(ActivityLog.created_at.desc())
        .all()
    )

    return [
        ActivityLogResponse(
            id=str(log.id),
            workspace_id=str(log.workspace_id),
            user_id=str(log.user_id) if log.user_id else None,
            event_type=log.event_type,
            description=log.description,
            ip_address=log.ip_address,
            user_agent=log.user_agent,
            created_at=log.created_at,
        )
        for log in logs
    ]


@router.get("/celery-health", status_code=status.HTTP_200_OK)
def check_celery_health():
    """Verify Celery task runner health status."""
    from src.monitoring.tasks import celery_health_check

    try:
        task = celery_health_check.delay()
        # Wait up to 2 seconds for response
        res = task.get(timeout=2.0)
        return {"status": "ok", "worker_response": res}
    except Exception as e:
        return {"status": "degraded", "error": str(e)}


@router.get("/queues", status_code=status.HTTP_200_OK)
def list_queues_metrics(current_user: User = Depends(get_current_user)):
    """Retrieve active and reserved tasks from Celery and lengths of Redis queues."""
    from src.core.redis_pubsub import sync_redis
    from src.celery_app import celery_app

    # 1. Fetch Redis Queue Lengths
    queue_lengths = {}
    for queue in ["default", "high_priority", "heavy_ops", "dead_letter"]:
        try:
            # Redis lists lengths representing queued tasks
            queue_lengths[queue] = sync_redis.llen(queue)
        except Exception:
            queue_lengths[queue] = 0

    # 2. Fetch Celery Worker Telemetries
    active_tasks_count = 0
    reserved_tasks_count = 0
    active_workers = []

    try:
        inspect = celery_app.control.inspect()
        active = inspect.active()
        reserved = inspect.reserved()

        if active:
            active_workers = list(active.keys())
            active_tasks_count = sum(len(tasks) for tasks in active.values())
        if reserved:
            reserved_tasks_count = sum(len(tasks) for tasks in reserved.values())
    except Exception:
        pass

    return {
        "redis_queues": queue_lengths,
        "celery_workers": {
            "active_nodes": active_workers,
            "active_tasks": active_tasks_count,
            "reserved_tasks": reserved_tasks_count,
        },
    }

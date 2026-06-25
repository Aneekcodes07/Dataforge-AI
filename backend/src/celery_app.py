"""
Celery Task Runner Configuration.
Defines connection parameters, task queues, routing, and periodic scheduling.
"""

from celery import Celery
from kombu import Queue
from src.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "dataforge_tasks",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

# Advanced Celery Configurations
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    # Reliability Settings
    task_acks_late=True,  # Acknowledge tasks after execution completes
    task_reject_on_worker_lost=True,  # Reject task if worker process terminates unexpectedly
    task_time_limit=3600,  # Hard limit for task duration (1 hour)
    task_soft_time_limit=3300,  # Soft limit to raise SoftTimeLimitExceeded (55 minutes)
    result_expires=86400,  # Expire results after 24 hours
)

# Multi-Queue & Dead Letter Queue (DLQ) Setup
celery_app.conf.task_default_queue = "default"
celery_app.conf.task_queues = (
    Queue("default", routing_key="default"),
    Queue("high_priority", routing_key="high_priority"),
    Queue("heavy_ops", routing_key="heavy_ops"),
    Queue("dead_letter", routing_key="dead_letter"),
)

# Configure task routing.
# IMPORTANT: keys MUST match the `name=` registered on each @celery_app.task.
# Heavy, long-running pipeline/agent work goes to `heavy_ops`; fast,
# latency-sensitive bookkeeping goes to `high_priority`.
celery_app.conf.task_routes = {
    # Pipeline orchestrator (src/agents/tasks.py) — runs all stages inline.
    "run_extraction_pipeline_task": {"queue": "heavy_ops"},
    # Copilot query processing (src/copilot/tasks.py)
    "run_copilot_query_task": {"queue": "heavy_ops"},
    # Notifications, activity feed, and health (src/monitoring/tasks.py)
    "process_notification_task": {"queue": "high_priority"},
    "log_activity_task": {"queue": "high_priority"},
    "celery_health_check": {"queue": "high_priority"},
}

# Celery Beat periodic scheduler
celery_app.conf.beat_schedule = {
    "periodic-health-check-60s": {
        "task": "celery_health_check",
        "schedule": 60.0,
    }
}

# Discover tasks within src modules
celery_app.autodiscover_tasks(["src.agents", "src.monitoring", "src.copilot"])

"""
Observability module integrating Sentry SDK and Prometheus Client metrics.
"""

import time
import os
import logging
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from prometheus_client import Counter, Histogram, Gauge
from prometheus_client.registry import REGISTRY
from sqlalchemy import event
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)

# ----------------------------------------------------
# 1. Prometheus Metrics Definitions
# ----------------------------------------------------

# HTTP request counters & histograms
HTTP_REQUESTS_TOTAL = Counter(
    "http_requests_total",
    "Total number of HTTP requests processed",
    ["method", "endpoint", "status"]
)

HTTP_REQUEST_DURATION_SECONDS = Histogram(
    "http_request_duration_seconds",
    "HTTP request execution latency in seconds",
    ["method", "endpoint"],
    buckets=(0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1.0, 2.5, 5.0, 10.0, float("inf"))
)

# Active websocket gauge
WEBSOCKET_CONNECTIONS_ACTIVE = Gauge(
    "websocket_connections_active",
    "Current number of active WebSocket client connections",
    ["room"]
)

# Database latency histogram
DATABASE_QUERY_DURATION_SECONDS = Histogram(
    "database_query_duration_seconds",
    "SQLAlchemy database query execution latency in seconds",
    ["statement_type"],
    buckets=(0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, float("inf"))
)

# Redis operation counters
REDIS_OPERATIONS_TOTAL = Counter(
    "redis_operations_total",
    "Total number of operations executed on Redis Cache/Broker",
    ["operation_type"]
)

# Celery task execution counters
CELERY_TASKS_TOTAL = Counter(
    "celery_tasks_total",
    "Total number of Celery background tasks processed",
    ["task_name", "status"]
)

# Pipeline runs counter
PIPELINE_RUNS_TOTAL = Counter(
    "pipeline_runs_total",
    "Total number of pipeline runs triggered",
    ["pipeline_id", "status"]
)

# Agent telemetry gauges
AGENT_TELEMETRY_METRICS = Gauge(
    "agent_telemetry_metrics",
    "Agent telemetry gauge reporting status, throughput, queue size, and health",
    ["agent_type", "metric_type"]
)

# Service health status gauges (1 = healthy, 0 = degraded)
SERVICE_HEALTH_STATUS = Gauge(
    "service_health_status",
    "Status of downstream services (1 = healthy, 0 = degraded)",
    ["service_name"]
)

# ----------------------------------------------------
# 2. Database Query Metrics Instrumentation
# ----------------------------------------------------

@event.listens_for(Engine, "before_cursor_execute")
def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    """Start timer before query execution starts."""
    context._query_start_time = time.time()

@event.listens_for(Engine, "after_cursor_execute")
def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    """Compute query latency and observe metric."""
    if hasattr(context, "_query_start_time"):
        latency = time.time() - context._query_start_time
        # Determine query type (SELECT, INSERT, UPDATE, DELETE, etc.)
        stmt_type = statement.strip().split(" ")[0].upper() if statement else "UNKNOWN"
        DATABASE_QUERY_DURATION_SECONDS.labels(statement_type=stmt_type).observe(latency)

# ----------------------------------------------------
# 3. HTTP Middleware for Requests Latency & Counts
# ----------------------------------------------------

class PrometheusMetricsMiddleware(BaseHTTPMiddleware):
    """FastAPI Middleware to automatically track HTTP endpoints request counters and execution times."""
    async def dispatch(self, request: Request, call_next):
        # Skip metrics and health check paths to keep Prometheus data clean and prevent log spam
        path = request.url.path
        if path in ("/api/monitoring/metrics", "/api/health", "/api/health/ws"):
            return await call_next(request)

        method = request.method
        start_time = time.time()
        
        try:
            response = await call_next(request)
            duration = time.time() - start_time
            status = str(response.status_code)
            
            HTTP_REQUESTS_TOTAL.labels(method=method, endpoint=path, status=status).inc()
            HTTP_REQUEST_DURATION_SECONDS.labels(method=method, endpoint=path).observe(duration)
            return response
        except Exception as exc:
            duration = time.time() - start_time
            HTTP_REQUESTS_TOTAL.labels(method=method, endpoint=path, status="500").inc()
            HTTP_REQUEST_DURATION_SECONDS.labels(method=method, endpoint=path).observe(duration)
            raise exc

# ----------------------------------------------------
# 4. Sentry Exception Monitoring Integration
# ----------------------------------------------------

def init_sentry():
    """Initialize Sentry SDK for capturing unhandled exceptions and performance telemetry in FastAPI & Celery."""
    sentry_dsn = os.getenv("SENTRY_DSN")
    if not sentry_dsn:
        logger.info("Sentry DSN not configured. Exception tracking is disabled.")
        return

    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastAPIIntegration
        from sentry_sdk.integrations.celery import CeleryIntegration
        
        sentry_sdk.init(
            dsn=sentry_dsn,
            integrations=[
                FastAPIIntegration(),
                CeleryIntegration(),
            ],
            # Tune trace sample rate for performance vs trace counts (e.g. capture 10% of HTTP/Celery transactions)
            traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.1")),
            environment=os.getenv("ENVIRONMENT", "production"),
            send_default_pii=True
        )
        logger.info("Sentry SDK successfully initialized and integrated with FastAPI and Celery.")
    except ImportError:
        logger.warning("sentry-sdk not installed. Skipping sentry setup.")
    except Exception as e:
        logger.error(f"Failed to initialize Sentry: {e}")

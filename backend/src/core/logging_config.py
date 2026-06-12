"""
Structured JSON logging config for FastAPI requests and Celery tasks.
"""

import time
import json
import logging
from datetime import datetime
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from celery.signals import after_setup_logger, after_setup_task_logger


class JSONFormatter(logging.Formatter):
    """Formats log records as JSON objects for structured logging in production."""

    def format(self, record):
        log_data = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        # Pull extra attributes if present
        for attr in ("method", "path", "status_code", "duration_ms", "client_ip"):
            if hasattr(record, attr):
                log_data[attr] = getattr(record, attr)

        return json.dumps(log_data)


def setup_logging():
    """Configure system loggers to output structured JSON format."""
    root_logger = logging.getLogger()
    # Replace handlers on root logger
    for handler in list(root_logger.handlers):
        root_logger.removeHandler(handler)

    console_handler = logging.StreamHandler()
    console_handler.setFormatter(JSONFormatter())
    root_logger.addHandler(console_handler)
    root_logger.setLevel(logging.INFO)

    # Apply configuration to web server and task runners
    for logger_name in ("uvicorn", "uvicorn.access", "uvicorn.error", "celery"):
        logger = logging.getLogger(logger_name)
        for handler in list(logger.handlers):
            logger.removeHandler(handler)
        handler = logging.StreamHandler()
        handler.setFormatter(JSONFormatter())
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
        logger.propagate = False


# Celery specific signal handlers to configure JSON formatters inside workers
@after_setup_logger.connect
def setup_celery_logger(logger, *args, **kwargs):
    for handler in list(logger.handlers):
        logger.removeHandler(handler)
    handler = logging.StreamHandler()
    handler.setFormatter(JSONFormatter())
    logger.addHandler(handler)


@after_setup_task_logger.connect
def setup_celery_task_logger(logger, *args, **kwargs):
    for handler in list(logger.handlers):
        logger.removeHandler(handler)
    handler = logging.StreamHandler()
    handler.setFormatter(JSONFormatter())
    logger.addHandler(handler)


class StructuredLoggingMiddleware(BaseHTTPMiddleware):
    """FastAPI Middleware to capture request details and log them as structured JSON."""

    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        client_ip = request.client.host if request.client else "unknown"

        # Don't log health check endpoints to avoid database connection polling log spam
        if request.url.path in ("/api/health", "/api/health/ws"):
            return await call_next(request)

        try:
            response = await call_next(request)
            process_time = (time.time() - start_time) * 1000

            logger = logging.getLogger("uvicorn.access")
            logger.info(
                f"{request.method} {request.url.path} - {response.status_code} ({process_time:.2f}ms)",
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": response.status_code,
                    "duration_ms": round(process_time, 2),
                    "client_ip": client_ip,
                },
            )
            return response
        except Exception as e:
            process_time = (time.time() - start_time) * 1000
            logger = logging.getLogger("uvicorn.error")
            logger.error(
                f"Exception during request: {str(e)}",
                exc_info=True,
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": 500,
                    "duration_ms": round(process_time, 2),
                    "client_ip": client_ip,
                },
            )
            raise e

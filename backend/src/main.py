"""
DataForge AI — Backend API Server
FastAPI application factory with CORS and health check.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, Response
from fastapi.middleware.cors import CORSMiddleware
import json

from src.core.database import get_db
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST

from src.auth.router import router as auth_router
from src.projects.router import router as projects_router
from src.datasets.router import router as datasets_router
from src.extraction.router import router as extraction_router
from src.pipelines.router import router as pipelines_router
from src.monitoring.router import router as monitoring_router
from src.copilot.router import router as copilot_router, handle_copilot_stream
from src.ai.router import router as ai_router
from src.core.websockets import ws_manager
from src.core.redis_pubsub import redis_pubsub_listener
from src.core.logging_config import setup_logging, StructuredLoggingMiddleware
from src.core.observability import (
    init_sentry,
    PrometheusMetricsMiddleware,
    WEBSOCKET_CONNECTIONS_ACTIVE,
)
from src.core.config import get_settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # NOTE: Database schema is managed exclusively by Alembic migrations
    # (see backend/entrypoint.sh which runs `alembic upgrade head` on startup).
    # We intentionally do NOT call Base.metadata.create_all() here so that the
    # migration history remains the single source of truth for the schema.
    # Start background Redis Pub/Sub WebSocket bridge
    import asyncio

    listener_task = asyncio.create_task(redis_pubsub_listener())
    yield
    # Clean up background task on exit
    listener_task.cancel()
    try:
        await listener_task
    except asyncio.CancelledError:
        pass


def create_app() -> FastAPI:
    # Initialize structured logging at the absolute beginning of application bootstrap
    setup_logging()
    # Initialize Sentry error reporting and performance tracking
    init_sentry()

    settings = get_settings()
    # Fail fast in production if the JWT signing secret is missing, too short,
    # or one of the well-known placeholder values shipped in templates/examples.
    # This guard is intentionally independent of any single literal so that
    # weak defaults can never silently reach a production deployment.
    _INSECURE_SECRETS = {
        "",
        "dev-secret-key-change-in-production",
        "prod-secret-key-change-in-production",
        "changeme",
        "secret",
        "your-secret-key",
    }
    if not settings.DEBUG and (
        settings.SECRET_KEY in _INSECURE_SECRETS or len(settings.SECRET_KEY) < 32
    ):
        raise RuntimeError(
            "CRITICAL SECURITY ERROR: SECRET_KEY must be set to a strong, unique "
            "value of at least 32 characters in production. Refusing to start with "
            "a missing or well-known placeholder secret."
        )

    app = FastAPI(
        title="DataForge AI",
        description="AI-powered Data Engineering Platform API",
        version="0.1.0",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        lifespan=lifespan,
    )

    # Prometheus HTTP Request Metrics Middleware (executed first)
    app.add_middleware(PrometheusMetricsMiddleware)

    # Structured logging request middleware (needs to run before CORS and routers)
    app.add_middleware(StructuredLoggingMiddleware)

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Routers
    app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])
    app.include_router(projects_router, prefix="/api/projects", tags=["Projects"])
    app.include_router(datasets_router, prefix="/api/datasets", tags=["Datasets"])
    app.include_router(extraction_router, prefix="/api/extraction", tags=["Extraction"])
    app.include_router(pipelines_router, prefix="/api/pipelines", tags=["Pipelines"])
    app.include_router(monitoring_router, prefix="/api/monitoring", tags=["Monitoring"])
    app.include_router(copilot_router, prefix="/api/copilot", tags=["Copilot"])
    app.include_router(ai_router, prefix="/api", tags=["Usage"])

    @app.get("/api/health", tags=["System"])
    async def health_check(db=Depends(get_db)):
        from src.core.redis_pubsub import sync_redis
        from src.celery_app import celery_app
        from src.core.observability import SERVICE_HEALTH_STATUS

        status_details = {
            "backend": "ok",
            "database": "unknown",
            "redis": "unknown",
            "celery": "unknown",
        }

        # 1. Database Check
        try:
            from sqlalchemy import text

            db.execute(text("SELECT 1"))
            status_details["database"] = "ok"
            SERVICE_HEALTH_STATUS.labels(service_name="database").set(1)
        except Exception as e:
            status_details["database"] = f"error: {str(e)}"
            SERVICE_HEALTH_STATUS.labels(service_name="database").set(0)

        # 2. Redis Check
        try:
            if sync_redis.ping():
                status_details["redis"] = "ok"
                SERVICE_HEALTH_STATUS.labels(service_name="redis").set(1)
            else:
                status_details["redis"] = "degraded"
                SERVICE_HEALTH_STATUS.labels(service_name="redis").set(0)
        except Exception as e:
            status_details["redis"] = f"error: {str(e)}"
            SERVICE_HEALTH_STATUS.labels(service_name="redis").set(0)

        # 3. Celery Check
        try:
            # Send a fast ping control command (0.5s timeout) to workers
            ping_responses = celery_app.control.ping(timeout=0.5)
            if ping_responses:
                status_details["celery"] = "ok"
                SERVICE_HEALTH_STATUS.labels(service_name="celery").set(1)
            else:
                status_details["celery"] = "no workers active"
                SERVICE_HEALTH_STATUS.labels(service_name="celery").set(0)
        except Exception as e:
            status_details["celery"] = f"error: {str(e)}"
            SERVICE_HEALTH_STATUS.labels(service_name="celery").set(0)

        # Overall health calculation
        overall_status = "ok"
        if any(v != "ok" for v in status_details.values()):
            overall_status = "degraded"

        return {
            "status": overall_status,
            "version": "0.1.0",
            "service": "dataforge-ai",
            "details": status_details,
        }

    @app.websocket("/api/health/ws")
    async def websocket_health_check(websocket: WebSocket):
        await websocket.accept()
        try:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
        except Exception:
            pass
        finally:
            await websocket.close()

    @app.get("/api/monitoring/metrics", tags=["Monitoring"])
    def get_metrics():
        """Expose Prometheus format metric payloads for scraping."""
        return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

    @app.websocket("/api/ws")
    async def websocket_gateway(websocket: WebSocket):
        token = websocket.query_params.get("token")
        if not token:
            await websocket.close(code=4008)  # Policy violation
            return

        auth_res = await ws_manager.authenticate_and_connect(websocket, token)
        if not auth_res:
            return

        user_id, workspace_id = auth_res
        room_label = f"workspace:{workspace_id}"

        # Increment active WebSockets counter
        WEBSOCKET_CONNECTIONS_ACTIVE.labels(room=room_label).inc()

        try:
            while True:
                data = await websocket.receive_text()
                if data == "ping":
                    await websocket.send_text("pong")
                    continue

                try:
                    payload = json.loads(data)
                    event = payload.get("event")
                    if event == "ping":
                        await websocket.send_json({"event": "pong"})
                    elif (
                        event == "copilot.query"
                        or payload.get("type") == "copilot.query"
                    ):
                        # Support camelCase and snake_case keys
                        session_id = payload.get("sessionId") or payload.get(
                            "session_id"
                        )
                        query_text = payload.get("text")
                        if session_id and query_text:
                            import asyncio

                            asyncio.create_task(
                                handle_copilot_stream(
                                    user_id,
                                    workspace_id,
                                    session_id,
                                    query_text,
                                    websocket,
                                )
                            )
                except Exception:
                    pass
        except WebSocketDisconnect:
            ws_manager.disconnect(websocket)
        except Exception:
            ws_manager.disconnect(websocket)
        finally:
            # Decrement active WebSockets counter on client disconnect
            WEBSOCKET_CONNECTIONS_ACTIVE.labels(room=room_label).dec()

    return app


app = create_app()

"""
Redis Pub/Sub bridge facilitating multi-process WebSocket broadcasts.
"""

import json
import logging
import redis
import redis.asyncio as aioredis
from src.core.config import get_settings
from src.core.websockets import ws_manager

logger = logging.getLogger(__name__)
settings = get_settings()

# Synchronous connection pool for workers and hooks
sync_redis = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)


def publish_ws_event(room: str, event_type: str, payload: dict):
    """Publish a workspace or user event to the global FastAPI WebSocket bridge."""
    try:
        message = {
            "room": room,
            "event": event_type,
            "data": payload
        }
        sync_redis.publish("dataforge_ws_broadcast", json.dumps(message))
    except Exception as e:
        logger.error(f"Failed to publish WebSocket event to Redis: {e}")


def publish_extraction_event(project_id: str, payload: dict):
    """Publish a pipeline run progress log directly to the project's WebSocket subscription channel."""
    try:
        sync_redis.publish(f"extraction_stream:{project_id}", json.dumps(payload))
    except Exception as e:
        logger.error(f"Failed to publish extraction event to Redis: {e}")


async def redis_pubsub_listener():
    """Background listener task running inside FastAPI, forwarding events to ws_manager rooms."""
    logger.info("Starting Redis Pub/Sub listener task...")
    try:
        pubsub_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        pubsub = pubsub_client.pubsub()
        await pubsub.subscribe("dataforge_ws_broadcast")
        logger.info("Successfully subscribed to Redis channel: dataforge_ws_broadcast")

        async for message in pubsub.listen():
            if message["type"] == "message":
                try:
                    payload = json.loads(message["data"])
                    room = payload.get("room")
                    event = payload.get("event")
                    data = payload.get("data")
                    if room and event:
                        await ws_manager.broadcast_to_room(room, event, data)
                except Exception as parse_err:
                    logger.error(f"Failed to parse Pub/Sub broadcast payload: {parse_err}")
    except Exception as e:
        logger.error(f"Redis Pub/Sub listener encountered critical error: {e}")

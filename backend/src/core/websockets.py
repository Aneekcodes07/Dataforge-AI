"""
WebSocket Gateway Connection Manager.
Handles socket registration, authentication, room-based pub/sub broadcasting, and connection lifecycle.
"""

import logging
from typing import Dict, Set, Optional, Tuple
from fastapi import WebSocket
from sqlalchemy.orm import Session

from src.core.database import SessionLocal
from src.core.security import decode_token
from src.auth.models import WorkspaceMembership

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Multi-room subscription manager for WebSocket multiplexing."""

    def __init__(self):
        # Maps room names to sets of active WebSockets
        self.rooms: Dict[str, Set[WebSocket]] = {}
        # Maps WebSocket connection to user metadata (user_id, active_workspace_id)
        self.connections: Dict[WebSocket, Tuple[str, str]] = {}

    async def authenticate_and_connect(
        self, websocket: WebSocket, token: str
    ) -> Optional[Tuple[str, str]]:
        """Verify JWT token, resolve user/workspace, and subscribe socket to relevant channels."""
        try:
            # 1. Decode token
            payload = decode_token(token)
            user_id = payload.get("sub")
            token_type = payload.get("type")
            if not user_id or token_type != "access":
                logger.warning("WebSocket handshake failed: invalid token payload")
                await websocket.close(code=4008)  # Policy violation
                return None
        except Exception as e:
            logger.warning(f"WebSocket handshake token decode failed: {e}")
            await websocket.close(code=4008)
            return None

        # 2. Accept connection
        await websocket.accept()

        # 3. Retrieve user's active workspace membership
        db: Session = SessionLocal()
        try:
            import uuid

            user_uuid = uuid.UUID(user_id)
            membership = (
                db.query(WorkspaceMembership)
                .filter(WorkspaceMembership.user_id == user_uuid)
                .first()
            )
            workspace_id = str(membership.workspace_id) if membership else None
        except Exception as e:
            logger.error(f"WebSocket db resolve failed: {e}")
            workspace_id = None
        finally:
            db.close()

        if not workspace_id:
            logger.warning(
                f"WebSocket connect: user {user_id} does not belong to any workspace"
            )
            await websocket.close(code=4008)
            return None

        # 4. Save metadata
        self.connections[websocket] = (user_id, workspace_id)

        # 5. Subscribe to channels
        self.subscribe_to_room(websocket, f"user:{user_id}")
        self.subscribe_to_room(websocket, f"workspace:{workspace_id}")

        logger.info(
            f"WebSocket client connected: user={user_id}, workspace={workspace_id}"
        )
        return user_id, workspace_id

    def subscribe_to_room(self, websocket: WebSocket, room: str):
        """Subscribe socket to a room channel."""
        if room not in self.rooms:
            self.rooms[room] = set()
        self.rooms[room].add(websocket)

    def unsubscribe_from_room(self, websocket: WebSocket, room: str):
        """Unsubscribe socket from a specific room channel."""
        if room in self.rooms and websocket in self.rooms[room]:
            self.rooms[room].remove(websocket)
            if not self.rooms[room]:
                del self.rooms[room]

    def disconnect(self, websocket: WebSocket):
        """Unsubscribe socket from all channels on connection teardown."""
        if websocket in self.connections:
            user_id, workspace_id = self.connections[websocket]
            del self.connections[websocket]

        for room in list(self.rooms.keys()):
            if websocket in self.rooms[room]:
                self.rooms[room].remove(websocket)
                if not self.rooms[room]:
                    del self.rooms[room]

        logger.info("WebSocket client disconnected and cleaned up")

    async def broadcast_to_room(self, room: str, event_type: str, payload: dict):
        """Send a JSON payload formatted as an event schema to all clients subscribed to a room."""
        if room not in self.rooms:
            return

        message = {"event": event_type, "data": payload}

        # Iterate over copy to prevent mutation errors during eviction
        for socket in list(self.rooms[room]):
            try:
                await socket.send_json(message)
            except Exception as e:
                logger.warning(
                    f"WebSocket broadcast failure to socket in room {room}: {e}. Evicting."
                )
                self.disconnect(socket)
                try:
                    await socket.close()
                except Exception:
                    pass

    async def send_to_user(self, user_id: str, event_type: str, payload: dict):
        """Direct message helper for sending to all active connections of a specific user."""
        await self.broadcast_to_room(f"user:{user_id}", event_type, payload)

    async def broadcast_to_workspace(
        self, workspace_id: str, event_type: str, payload: dict
    ):
        """Broadcast helper for sending event payload to all members of a workspace."""
        await self.broadcast_to_room(f"workspace:{workspace_id}", event_type, payload)


# Instantiated global singleton
ws_manager = ConnectionManager()

import json
import uuid
from typing import Dict, Set, List
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[uuid.UUID, Set[WebSocket]] = {}

    async def connect(self, user_id: uuid.UUID, websocket: WebSocket):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
            await self.broadcast_presence(user_id, is_online=True)
        self.active_connections[user_id].add(websocket)

    def disconnect(self, user_id: uuid.UUID, websocket: WebSocket):
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

                import asyncio
                asyncio.create_task(self.broadcast_presence(user_id, is_online=False))

    async def broadcast_presence(self, user_id: uuid.UUID, is_online: bool):
        payload = {
            "event": "user_online" if is_online else "user_offline",
            "user_id": str(user_id)
        }
        data = json.dumps(payload)
        for target_id, sockets in list(self.active_connections.items()):
            for ws in list(sockets):
                try:
                    await ws.send_text(data)
                except Exception:
                    pass

    async def broadcast_to_participants(self, participant_ids: List[uuid.UUID], payload: dict):
        data = json.dumps(payload)
        for pid in participant_ids:
            if pid in self.active_connections:
                for ws in list(self.active_connections[pid]):
                    try:
                        await ws.send_text(data)
                    except Exception:
                        self.active_connections[pid].discard(ws)

    async def send_to_user(self, user_id: uuid.UUID, message: dict):
        if user_id in self.active_connections:
            data = json.dumps(message)
            for ws in list(self.active_connections[user_id]):
                try:
                    await ws.send_text(data)
                except Exception:
                    self.active_connections[user_id].discard(ws)

    def is_user_online(self, user_id: uuid.UUID) -> bool:
        return user_id in self.active_connections and len(self.active_connections[user_id]) > 0

ws_manager = ConnectionManager()

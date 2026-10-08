import asyncio
import json
import random
import string
import time
from typing import Any, Dict, List, Optional, Set
from fastapi import WebSocket

class JamSession:
    def __init__(self, jam_id: str, host_id: str, host_name: str):
        self.jam_id = jam_id
        self.host_id = host_id
        self.host_name = host_name
        self.created_at = time.time()
        
        # Playback state
        self.current_track: Optional[Dict[str, Any]] = None
        self.is_playing: bool = False
        self.current_time: float = 0.0
        self.last_update_ts: float = time.time()
        self.queue: List[Dict[str, Any]] = []
        self.queue_index: int = 0
        
        # Participants: user_id -> info
        self.participants: Dict[str, Dict[str, Any]] = {
            host_id: {
                "id": host_id,
                "name": host_name,
                "is_host": True,
                "joined_at": time.time()
            }
        }
        
        # Active WebSockets
        self.connections: Set[WebSocket] = set()

    def get_estimated_current_time(self) -> float:
        if self.is_playing:
            elapsed = time.time() - self.last_update_ts
            return self.current_time + elapsed
        return self.current_time

    def to_state_dict(self) -> Dict[str, Any]:
        return {
            "jam_id": self.jam_id,
            "host_id": self.host_id,
            "host_name": self.host_name,
            "current_track": self.current_track,
            "is_playing": self.is_playing,
            "current_time": self.get_estimated_current_time(),
            "last_update_ts": self.last_update_ts,
            "queue": self.queue,
            "queue_index": self.queue_index,
            "participants": list(self.participants.values()),
            "listener_count": len(self.participants)
        }

    async def broadcast(self, message: Dict[str, Any], exclude: Optional[WebSocket] = None):
        msg_str = json.dumps(message)
        dead_conns = set()
        for conn in self.connections:
            if conn != exclude:
                try:
                    await conn.send_text(msg_str)
                except Exception:
                    dead_conns.add(conn)
        for dead in dead_conns:
            self.connections.discard(dead)

class JamManager:
    def __init__(self):
        self.sessions: Dict[str, JamSession] = {}

    def _generate_code(self) -> str:
        chars = string.ascii_uppercase + string.digits
        return "JAM-" + "".join(random.choices(chars, k=5))

    def create_session(self, host_id: str, host_name: str) -> JamSession:
        jam_id = self._generate_code()
        session = JamSession(jam_id, host_id, host_name)
        self.sessions[jam_id] = session
        return session

    def get_session(self, jam_id: str) -> Optional[JamSession]:
        clean_id = jam_id.strip().upper()
        if not clean_id.startswith("JAM-") and len(clean_id) == 5:
            clean_id = f"JAM-{clean_id}"
        return self.sessions.get(clean_id)

    async def register_connection(self, jam_id: str, websocket: WebSocket, user_id: str, user_name: str) -> Optional[JamSession]:
        session = self.get_session(jam_id)
        if not session:
            return None
        session.connections.add(websocket)
        session.participants[user_id] = {
            "id": user_id,
            "name": user_name,
            "is_host": (user_id == session.host_id),
            "joined_at": time.time()
        }
        # Notify all participants
        await session.broadcast({
            "type": "USER_JOINED",
            "user": session.participants[user_id],
            "state": session.to_state_dict()
        })
        return session

    async def unregister_connection(self, jam_id: str, websocket: WebSocket, user_id: str):
        session = self.get_session(jam_id)
        if not session:
            return
        session.connections.discard(websocket)
        if user_id in session.participants:
            del session.participants[user_id]
            await session.broadcast({
                "type": "USER_LEFT",
                "user_id": user_id,
                "state": session.to_state_dict()
            })
        
        # Clean up empty session after 10 minutes
        if len(session.connections) == 0 and len(session.participants) == 0:
            pass

jam_manager = JamManager()

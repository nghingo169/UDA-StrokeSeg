"""In-memory WebSocket fan-out for consultation rooms."""

from __future__ import annotations

import asyncio
import json
from collections import defaultdict
from typing import Any

from fastapi import WebSocket


class ConsultationHub:
    def __init__(self) -> None:
        self._rooms: dict[str, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, consultation_id: str, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._rooms[consultation_id].add(ws)

    async def disconnect(self, consultation_id: str, ws: WebSocket) -> None:
        async with self._lock:
            peers = self._rooms.get(consultation_id)
            if not peers:
                return
            peers.discard(ws)
            if not peers:
                self._rooms.pop(consultation_id, None)

    async def broadcast(self, consultation_id: str, event: str, payload: dict[str, Any]) -> None:
        message = json.dumps({"event": event, "payload": payload})
        async with self._lock:
            peers = list(self._rooms.get(consultation_id, set()))
        stale: list[WebSocket] = []
        for ws in peers:
            try:
                await ws.send_text(message)
            except Exception:
                stale.append(ws)
        for ws in stale:
            await self.disconnect(consultation_id, ws)


consultation_hub = ConsultationHub()

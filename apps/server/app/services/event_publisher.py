"""Demo event bus publisher - records events in-memory for Swagger visibility."""

from __future__ import annotations

from datetime import datetime, timezone

_EVENTS: list[dict] = []


def publish(topic: str, payload: dict) -> dict:
    event = {
        "topic": topic,
        "payload": payload,
        "ts": datetime.now(timezone.utc).isoformat(),
    }
    _EVENTS.insert(0, event)
    return event


def recent(limit: int = 20) -> list[dict]:
    return _EVENTS[:limit]

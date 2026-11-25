"""PostgreSQL-backed compatibility aggregate for domains not yet fully normalized."""
from __future__ import annotations

import json
from copy import deepcopy
from typing import Any, Callable

from sqlalchemy import text

from app.db.domain import sync_consultations, write_audit
from app.db.session import SessionLocal
from app.demo_store import _seed


def snapshot() -> dict[str, Any]:
    with SessionLocal.begin() as db:
        row = db.execute(text("SELECT state FROM app_state WHERE state_key = 'demo' FOR UPDATE")).scalar_one_or_none()
        if row is None:
            state = _seed()
            db.execute(text("INSERT INTO app_state(state_key, state) VALUES ('demo', CAST(:state AS jsonb))"), {"state": json.dumps(state)})
            return deepcopy(state)
        return deepcopy(row)


def mutate(fn: Callable[[dict[str, Any]], Any]) -> Any:
    with SessionLocal.begin() as db:
        row = db.execute(text("SELECT state FROM app_state WHERE state_key = 'demo' FOR UPDATE")).scalar_one_or_none()
        state = row or _seed()
        result = fn(state)
        sync_consultations(db, state.get("Consultation", []))
        db.execute(text("""
            INSERT INTO app_state(state_key, state, updated_at)
            VALUES ('demo', CAST(:state AS jsonb), now())
            ON CONFLICT (state_key) DO UPDATE SET state = EXCLUDED.state, updated_at = now()
        """), {"state": json.dumps(state)})
        return result


def audit(event: str, actor: str, resource: str, result: str = "OK") -> None:
    write_audit(event, actor, resource, result)

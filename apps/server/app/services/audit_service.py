from app.demo_store import store
from app.core.config import settings
from app.db import domain


def list_audit(limit: int = 50) -> list[dict]:
    if not settings.demo_mode:
        return domain.list_audit(limit)
    return store.snapshot()["audit"][:limit]

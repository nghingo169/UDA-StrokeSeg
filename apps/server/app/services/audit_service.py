from app.demo_store import store


def list_audit(limit: int = 50) -> list[dict]:
    return store.snapshot()["audit"][:limit]

from app.demo_store import store
from app.core.config import settings
from app.db import domain


def list_users() -> list[dict]:
    if not settings.demo_mode:
        return domain.list_users()
    return store.snapshot()["users"]


def get_user(user_id: str) -> dict | None:
    if not settings.demo_mode:
        return domain.get_directory_user(user_id)
    target = str(user_id or "").strip()
    folded = target.lower()
    for user in store.snapshot()["users"]:
        current = str(user.get("id") or "")
        if current == target or current.lower() == folded:
            return user
    return None

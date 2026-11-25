from app.demo_store import store
from app.core.config import settings
from app.db import domain


def list_users() -> list[dict]:
    if not settings.demo_mode:
        return domain.list_users()
    return store.snapshot()["users"]


def get_user(user_id: str) -> dict | None:
    if not settings.demo_mode:
        return next((u for u in domain.list_users() if u["id"] == user_id), None)
    for user in store.snapshot()["users"]:
        if user["id"] == user_id:
            return user
    return None

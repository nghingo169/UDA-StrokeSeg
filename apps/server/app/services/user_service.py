from app.demo_store import store


def list_users() -> list[dict]:
    return store.snapshot()["users"]


def get_user(user_id: str) -> dict | None:
    for user in store.snapshot()["users"]:
        if user["id"] == user_id:
            return user
    return None

from fastapi import APIRouter, Depends

from app.api.deps import CurrentUser, get_current_user
from app.db import state as store

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
def list_notifications(user: CurrentUser = Depends(get_current_user)):
    items = store.snapshot()["notifications"]
    return [
        item
        for item in items
        if not item.get("recipient") or item.get("recipient") == user.username
    ]


@router.post("/read-all")
def read_all(user: CurrentUser = Depends(get_current_user)):
    def write(state):
        for item in state["notifications"]:
            item["read"] = True
        return state["notifications"]

    return store.mutate(write)

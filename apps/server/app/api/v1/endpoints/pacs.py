from fastapi import APIRouter, Depends

from app.api.deps import CurrentUser, require_roles
from app.demo_store import store

router = APIRouter(prefix="/pacs", tags=["pacs"])


@router.get("/nodes")
def nodes(_user: CurrentUser = Depends(require_roles("it"))):
    return store.snapshot()["pacs_nodes"]

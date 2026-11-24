from fastapi import APIRouter, Depends

from app.api.deps import CurrentUser, require_roles
from app.demo_store import store

router = APIRouter(prefix="/quarantine", tags=["quarantine"])


@router.get("")
def list_quarantine(_user: CurrentUser = Depends(require_roles("it", "hod"))):
    return store.snapshot()["quarantine"]

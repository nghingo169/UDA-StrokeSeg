from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import CurrentUser, require_roles
from app.services import audit_service

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("")
def list_audit(_user: CurrentUser = Depends(require_roles("it", "hod"))):
    return audit_service.list_audit()


@router.delete("")
def delete_forbidden():
    raise HTTPException(status_code=405, detail="Audit log is append-only")

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import CurrentUser, require_roles
from app.services import user_service

router = APIRouter(prefix="/users", tags=["users"])


@router.get("")
def list_users(_user: CurrentUser = Depends(require_roles("it", "hod"))):
    return user_service.list_users()


@router.get("/{user_id}")
def get_user(user_id: str, _user: CurrentUser = Depends(require_roles("it", "hod"))):
    user = user_service.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

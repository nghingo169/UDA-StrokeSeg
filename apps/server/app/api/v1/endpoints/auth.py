from fastapi import APIRouter, Depends

from app.api.deps import CurrentUser, get_current_user
from app.core.security import verify_demo_password
from app.schemas.auth_schema import LoginRequest, LoginResponse, MessageResponse, StepUpRequest
from app.services import auth_service
from app.demo_store import store

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest):
    return auth_service.login(body.username, body.password, body.role)


@router.get("/hrm/status")
def hrm_status():
    """Return the HRM directory connection state for the lecturer demo."""
    return auth_service.hrm_status()


@router.post("/hrm/sync")
def hrm_sync():
    """Refresh the in-memory directory from the configured HRM demo source.

    Production deployments replace this adapter with the hospital's OIDC/SAML
    provider; the application never provisions a local account from this call.
    """
    return auth_service.sync_hrm()


@router.post("/step-up", response_model=MessageResponse)
def step_up(body: StepUpRequest, user: CurrentUser = Depends(get_current_user)):
    verify_demo_password(body.password)
    return {"message": "Step-up confirmed", "detail": {"user": user.username}}


@router.get("/me")
def me(user: CurrentUser = Depends(get_current_user)):
    return user

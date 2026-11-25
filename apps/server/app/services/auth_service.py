from fastapi import HTTPException, status

from app.core.security import issue_token, verify_demo_password
from app.demo_store import store
from app.core.config import settings
from app.db import domain


def hrm_status() -> dict:
    state = store.snapshot()
    directory = state.get("users", [])
    return {
        "provider": "Hospital HRM (demo adapter)",
        "protocol": "OIDC/SAML",
        "status": "connected",
        "directory_users": len(directory),
        "local_account_provisioning": False,
        "last_sync": state.get("hrm_last_sync", "demo-seed"),
    }


def sync_hrm() -> dict:
    store.mutate(lambda state: state.__setitem__("hrm_last_sync", "just-now"))
    return {"message": "HRM directory synchronized", **hrm_status()}


def login(username: str, password: str, role: str | None = None) -> dict:
    verify_demo_password(password)

    if not settings.demo_mode:
        user = domain.find_user(username, role)
        if not user and role:
            user = next((item for item in domain.list_users() if item["role"] == role), None)
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unknown user")
        token = issue_token(user["role"], user["username"])
        domain.write_audit("LOGIN", user["username"], user["role"])
        return {"access_token": token, "token_type": "bearer", "role": user["role"],
                "user": {**user, "identity_source": "hospital-hrm", "account_provisioned_locally": False}}

    def find(state):
        matches = [u for u in state["users"] if u["username"] == username]
        if role:
            matches = [u for u in matches if u["role"] == role]
        return matches[0] if matches else None

    user = store.mutate(find)
    if not user:
        # allow role-only demo login: username may be role short name
        def by_role(state):
            for u in state["users"]:
                if u["role"] == (role or username):
                    return u
            return None

        user = store.mutate(by_role)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unknown user")

    token = issue_token(user["role"], user["username"])
    store.audit("LOGIN", user["username"], user["role"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user["role"],
        "user": {**user, "identity_source": "hospital-hrm", "account_provisioned_locally": False},
    }

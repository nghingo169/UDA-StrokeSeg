"""Request dependencies for the demo API."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Header, HTTPException, status

from app.core.security import parse_token
from app.demo_store import store


class CurrentUser(dict):
    @property
    def role(self) -> str:
        return self["role"]

    @property
    def username(self) -> str:
        return self["username"]

    @property
    def display_name(self) -> str:
        return self["display_name"]


def _find_user(role: str, username: str) -> dict | None:
    def find(state):
        for user in state["users"]:
            if user["username"] == username and user["role"] == role:
                return dict(user)
        return None

    return store.mutate(find)


def get_current_user(authorization: Annotated[str | None, Header()] = None) -> CurrentUser:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    role, username = parse_token(token)
    user = _find_user(role, username)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unknown user")
    return CurrentUser(user)


def get_optional_user(authorization: Annotated[str | None, Header()] = None) -> CurrentUser | None:
    if not authorization:
        return None
    try:
        return get_current_user(authorization)
    except HTTPException:
        return None


def require_roles(*roles: str):
    def _dep(user: Annotated[CurrentUser, Depends(get_current_user)]) -> CurrentUser:
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return user

    return _dep

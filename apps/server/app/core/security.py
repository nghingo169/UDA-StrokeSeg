"""Lightweight demo auth helpers (not production security)."""

from __future__ import annotations

from fastapi import HTTPException, status

from app.core.config import settings


def issue_token(role: str, username: str) -> str:
    # Use "|" so usernames with "." (e.g. lena.morgan) stay intact.
    return f"demo|{role}|{username}"


def parse_token(token: str) -> tuple[str, str]:
    parts = token.split("|", 2)
    if len(parts) != 3 or parts[0] != "demo":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return parts[1], parts[2]


def verify_demo_password(password: str) -> None:
    if password != settings.demo_password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

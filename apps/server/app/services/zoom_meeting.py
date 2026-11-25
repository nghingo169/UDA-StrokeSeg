"""Zoom Meeting REST + Meeting SDK JWT helpers."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import random
import secrets
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

from app.core.config import settings

_TOKEN_PATH = Path(__file__).resolve().parents[2] / ".zoom-oauth.json"
_oauth_state = ""


def credentials_present() -> bool:
    return bool(settings.zoom_client_id and settings.zoom_client_secret)


def sdk_app_key() -> str:
    return settings.zoom_sdk_key or settings.zoom_client_id


def sdk_app_secret() -> str:
    return settings.zoom_sdk_secret or settings.zoom_client_secret


def _stored_refresh_token() -> str:
    try:
        data = json.loads(_TOKEN_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return ""
    return str(data.get("refresh_token") or "")


def zoom_configured() -> bool:
    """A live REST call is possible: Server-to-Server credentials, or a saved OAuth grant."""
    if not credentials_present():
        return False
    if settings.zoom_account_id:
        return True
    return bool(_stored_refresh_token())


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def sign_meeting_sdk_jwt(*, meeting_number: str, role: int) -> str:
    """HS256 JWT for Meeting SDK Web (role 1 = host, 0 = participant)."""
    app_key = sdk_app_key()
    secret = sdk_app_secret()
    iat = int(time.time()) - 30
    exp = iat + 60 * 60 * 2
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "appKey": app_key,
        "mn": str(meeting_number),
        "role": int(role),
        "iat": iat,
        "exp": exp,
        "tokenExp": exp,
        "video_webrtc_mode": 0,
    }
    segments = f"{_b64url(json.dumps(header, separators=(',', ':')).encode())}."
    segments += _b64url(json.dumps(payload, separators=(',', ':')).encode())
    sig = hmac.new(secret.encode("utf-8"), segments.encode("utf-8"), hashlib.sha256).digest()
    return f"{segments}.{_b64url(sig)}"


def _basic_auth_header() -> str:
    raw = f"{settings.zoom_client_id}:{settings.zoom_client_secret}".encode()
    return "Basic " + base64.b64encode(raw).decode()


def _save_token_payload(data: dict[str, Any]) -> None:
    refresh = data.get("refresh_token") or _stored_refresh_token()
    payload = {
        "refresh_token": refresh,
        "access_token": data.get("access_token") or "",
        "expires_at": time.time() + int(data.get("expires_in") or 3600) - 60,
    }
    _TOKEN_PATH.write_text(json.dumps(payload), encoding="utf-8")


def _post_token(form: dict[str, str]) -> dict[str, Any]:
    req = urllib.request.Request(
        "https://zoom.us/oauth/token",
        data=urllib.parse.urlencode(form).encode(),
        method="POST",
        headers={
            "Authorization": _basic_auth_header(),
            "Content-Type": "application/x-www-form-urlencoded",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")
        try:
            message = json.loads(detail).get("reason") or json.loads(detail).get("error") or "Zoom token request failed"
        except json.JSONDecodeError:
            message = "Zoom token request failed"
        raise ValueError(str(message)) from exc


def authorization_url() -> str:
    global _oauth_state
    if not credentials_present():
        raise ValueError("Zoom client credentials are not configured")
    _oauth_state = secrets.token_urlsafe(24)
    query = urllib.parse.urlencode(
        {
            "response_type": "code",
            "client_id": settings.zoom_client_id,
            "redirect_uri": settings.zoom_redirect_uri,
            "state": _oauth_state,
        }
    )
    return f"https://zoom.us/oauth/authorize?{query}"


def exchange_code(code: str, state: str) -> None:
    global _oauth_state
    if not code:
        raise ValueError("Zoom did not return an authorization code")
    # Zoom's own authorize link omits state. Reject only a state that does not match one we issued.
    if state and state != _oauth_state:
        raise ValueError("Zoom authorization state did not match. Start again from /api/v1/zoom/authorize")
    data = _post_token(
        {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": settings.zoom_redirect_uri,
        }
    )
    if not data.get("refresh_token"):
        raise ValueError("Zoom did not return a refresh token")
    _save_token_payload(data)
    _oauth_state = ""


def _oauth_access_token() -> str | None:
    try:
        stored = json.loads(_TOKEN_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    access = str(stored.get("access_token") or "")
    if access and float(stored.get("expires_at") or 0) > time.time():
        return access
    refresh = str(stored.get("refresh_token") or "")
    if not refresh:
        return None
    try:
        data = _post_token({"grant_type": "refresh_token", "refresh_token": refresh})
    except (ValueError, urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        return None
    _save_token_payload(data)
    token = data.get("access_token")
    return str(token) if token else None


def _s2s_access_token() -> str | None:
    if not credentials_present() or not settings.zoom_account_id:
        return None
    query = (
        "grant_type=account_credentials"
        f"&account_id={urllib.parse.quote(settings.zoom_account_id)}"
    )
    req = urllib.request.Request(
        f"https://zoom.us/oauth/token?{query}",
        data=b"",
        method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    req.add_header("Authorization", _basic_auth_header())
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())
            return data.get("access_token")
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        return None


def _meeting_password() -> str:
    return f"uda{random.randint(1000, 9999)}"


class ZoomUnavailable(RuntimeError):
    """Raised when a live Zoom meeting cannot be created."""


def _access_token() -> str | None:
    if settings.zoom_account_id:
        return _s2s_access_token()
    return _oauth_access_token()


def fetch_host_zak() -> str | None:
    """Zoom Access Token (ZAK) for the account host. Promotes the Chairman on SDK join."""
    if not zoom_configured():
        return None
    token = _access_token()
    if not token:
        return None
    user_id = urllib.parse.quote(settings.zoom_host_user_id, safe="")
    req = urllib.request.Request(
        f"https://api.zoom.us/v2/users/{user_id}/token?type=zak",
        method="GET",
        headers={"Authorization": f"Bearer {token}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())
            zak = data.get("token")
            return str(zak) if zak else None
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        return None


def create_meeting(*, topic: str, duration_min: int = 90) -> dict[str, Any]:
    """Create a hidden Zoom meeting: password, waiting room, camera and mic off on entry."""
    if not zoom_configured():
        raise ZoomUnavailable("Zoom is not connected")

    token = _access_token()
    if not token:
        raise ZoomUnavailable("Zoom authorization expired. Connect Zoom again, then create a new consultation.")

    password = _meeting_password()
    start_time = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + 60))
    payload = {
        "topic": topic[:200],
        "type": 2,
        "start_time": start_time,
        "timezone": "UTC",
        "duration": duration_min,
        "password": password,
        "settings": {
            "waiting_room": True,
            "join_before_host": False,
            "mute_upon_entry": True,
            "host_video": False,
            "participant_video": False,
            "approval_type": 2,
        },
    }
    req = urllib.request.Request(
        f"https://api.zoom.us/v2/users/{settings.zoom_host_user_id}/meetings",
        data=json.dumps(payload).encode(),
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode())
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise ZoomUnavailable("Zoom could not create the meeting") from exc
    return {
        "id": data["id"],
        "password": data.get("password") or password,
        "join_url": data.get("join_url") or "",
        "start_url": data.get("start_url") or "",
        "zak": fetch_host_zak(),
        "mock": False,
        "topic": topic,
    }


def end_meeting(meeting_number: str) -> bool:
    if not zoom_configured() or not meeting_number:
        return True
    token = _access_token()
    if not token:
        return False
    req = urllib.request.Request(
        f"https://api.zoom.us/v2/meetings/{meeting_number}/status",
        data=json.dumps({"action": "end"}).encode(),
        method="PUT",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15):
            return True
    except urllib.error.URLError:
        return False


def join_payload(
    *,
    meeting_number: str,
    password: str,
    display_name: str,
    email: str,
    role: int,
    staff_id: str = "",
    zak: str | None = None,
) -> dict[str, Any]:
    """SDK join bundle. ZAK is returned only for the Chairman (host role)."""
    labeled = f"{display_name} [{staff_id}]" if staff_id else display_name
    return {
        "meeting_number": str(meeting_number),
        "password": password or "",
        "signature": sign_meeting_sdk_jwt(meeting_number=str(meeting_number), role=role),
        "sdk_key": sdk_app_key(),
        "sdk_lib_version": settings.zoom_sdk_version or "6.10.0",
        "user_name": labeled,
        "user_email": email,
        "staff_id": staff_id,
        "role": role,
        "zak": zak if role == 1 else None,
    }

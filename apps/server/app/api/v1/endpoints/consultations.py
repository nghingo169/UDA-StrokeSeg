"""Consultation lifecycle REST + WebSocket room sync.

Phases:
1. A radiologist requests a room (PENDING_ASSIGNMENT). The standing chairman
   (stroke physician) may also open one immediately for a Critical study.
2. Head of Department assigns the Chairman and participants (ASSIGNED).
   The standing chairman may assign themselves on a Critical study they opened.
3. Chairman joins as Zoom host via ZAK; other doctors join as participants.
   Live meetings are created through the connected Zoom account.
4. meeting.ended (chair or webhook) then Chairman signs the chart (COMPLETED).
"""

from __future__ import annotations

import hashlib
import hmac
import json
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, WebSocket, WebSocketDisconnect

from app.api.deps import CurrentUser, get_current_user
from app.core.config import settings
from app.core.security import parse_token, verify_demo_password
from app.db import state as store
from app.models.consultation import RoleInSession, empty_member, empty_session
from app.schemas.consultation_schema import (
    AgreementRequest,
    AssignConsultationRequest,
    ConclusionRequest,
    ConsensusRequest,
    CreateConsultationRequest,
    DiscussionRequest,
    InviteMemberRequest,
)
from app.services.consultation_hub import consultation_hub
from app.services.zoom_meeting import create_meeting, end_meeting, fetch_host_zak, join_payload

router = APIRouter(prefix="/consultation", tags=["Consultation"])

_TERMINAL = {"FINALIZED", "COMPLETED", "CANCELLED", "ENDED_WITHOUT_CONSENSUS"}
_ASSIGNABLE = {"DRAFT", "PENDING_ASSIGNMENT", "ASSIGNED", "SCHEDULED", "WAITING"}
_CLINICIANS = {"physician", "radiologist"}
_AGREEMENTS = {
    "agree": "Agree",
    "partial": "Partial",
    "disagree": "Disagree",
    "agree with ai mask": "Agree with AI mask",
    "adjust mask": "Adjust mask",
    "recommend thrombectomy": "Recommend thrombectomy",
    "recommend thrombolysis": "Recommend thrombolysis",
}
_NOTE_REQUIRED = {"Partial", "Disagree", "Adjust mask"}
_PRIVATE_ZOOM = ("zoom_start_url", "zoom_zak", "zoom_password")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _public_session(item: dict[str, Any]) -> dict[str, Any]:
    """Hide the host ZAK, start URL, and meeting password from list/detail payloads."""
    out = dict(item)
    # Keep the demo/live integration state explicit for the UI and API tests.
    # The value is stored on the session when the meeting is created; the
    # fallback keeps older seeded sessions compatible with demo mode.
    out["zoom_mock"] = bool(item.get("zoom_mock", settings.demo_mode))
    for key in _PRIVATE_ZOOM:
        out.pop(key, None)
    return out


def _find_session(state: dict[str, Any], consultation_id: str) -> dict[str, Any]:
    for item in state["Consultation"]:
        if item["id"] == consultation_id:
            return item
    raise HTTPException(status_code=404, detail="Consultation not found")


def _find_by_meeting(state: dict[str, Any], meeting_id: str) -> dict[str, Any] | None:
    target = str(meeting_id)
    for item in state["Consultation"]:
        if str(item.get("zoom_meeting_number") or "") == target:
            return item
    return None


def _find_member(session: dict[str, Any], user: CurrentUser) -> dict[str, Any] | None:
    for member in session.get("members", []):
        if isinstance(member, dict) and (
            member.get("username") == user.username or member.get("user_id") == user.get("id")
        ):
            return member
    return None


def _require_member(session: dict[str, Any], user: CurrentUser) -> dict[str, Any]:
    member = _find_member(session, user)
    if not member:
        raise HTTPException(status_code=403, detail="Not a consultation member")
    return member


def _is_chair(session: dict[str, Any], user: CurrentUser) -> bool:
    member = _find_member(session, user)
    if member and member.get("role_in_session") == "Chair":
        return True
    return bool(session.get("lead_chair_id")) and session.get("lead_chair_id") == user.get("id")


def _user_by_id(state: dict[str, Any], user_id: str) -> dict[str, Any] | None:
    for user in state["users"]:
        if user["id"] == user_id:
            return user
    return None


def _study_record(state: dict[str, Any], study_id: str) -> dict[str, Any] | None:
    for pool in ("studies", "signed_studies"):
        for item in state.get(pool, []):
            if item.get("id") == study_id:
                return item
    return None


def _study_exists(state: dict[str, Any], study_id: str) -> bool:
    return _study_record(state, study_id) is not None


def _is_emergency_self_assign(
    user: CurrentUser,
    session: dict[str, Any],
    state: dict[str, Any],
    chairman_user_id: str,
) -> bool:
    """Standing chairman opens a Critical study without waiting for HoD."""
    if user.role != "physician":
        return False
    if user.get("id") != session.get("requested_by_id"):
        return False
    if chairman_user_id != user.get("id"):
        return False
    study = _study_record(state, str(session.get("study_id") or ""))
    return bool(study) and study.get("status") == "Critical"


def _next_id(state: dict[str, Any]) -> str:
    n = len(state["Consultation"]) + 1
    return f"CON-{datetime.now().strftime('%m%d')}-{n:03d}"


def _staff_id(user: dict[str, Any]) -> str:
    return str(user.get("employee_id") or "")


def _can_assign(user: CurrentUser) -> bool:
    return user.role == "hod" or bool(user.get("consultation_delegate"))


def _chart_signature(consultation_id: str, username: str, signed_at: str, conclusion: str) -> str:
    secret = settings.zoom_sdk_secret or settings.demo_password
    message = f"{consultation_id}|{username}|{signed_at}|{conclusion}".encode()
    digest = hmac.new(secret.encode("utf-8"), message, hashlib.sha256).hexdigest()
    return f"sig-v1:{digest}"


def _member_from_user(profile: dict[str, Any], role: RoleInSession) -> dict[str, Any]:
    return empty_member(
        user_id=profile["id"],
        username=profile["username"],
        display_name=profile["display_name"],
        role_in_session=role,
        initials=profile.get("initials", "??"),
        employee_id=_staff_id(profile),
    )


def _notify(
    state: dict[str, Any],
    *,
    recipient: str,
    title: str,
    body: str,
    consultation_id: str,
) -> None:
    state.setdefault("notifications", []).insert(
        0,
        {
            "id": f"n-{consultation_id}-{recipient}-{len(state.get('notifications', []))}",
            "title": title,
            "body": body,
            "read": False,
            "recipient": recipient,
            "consultation_id": consultation_id,
            "join_path": f"Consultation/session/{consultation_id}",
        },
    )
    state.setdefault("email_log", []).insert(
        0,
        {
            "to": f"{recipient}@demo.uda.local",
            "subject": title,
            "body": body,
            "consultation_id": consultation_id,
            "sent_at": _now(),
        },
    )


def _require_assigned(session: dict[str, Any]) -> None:
    if session["status"] in _TERMINAL or session["status"] == "AWAITING_CONCLUSION":
        raise HTTPException(status_code=409, detail="Consultation already ended")
    if session["status"] == "PENDING_ASSIGNMENT" or not session.get("lead_chair_id"):
        raise HTTPException(status_code=409, detail="Chairman has not been assigned")


def _host_zak(session: dict[str, Any]) -> str | None:
    fresh = fetch_host_zak()
    zak = fresh or session.get("zoom_zak")
    if zak:
        session["zoom_zak"] = zak
    return zak


def _zoom_for(session: dict[str, Any], user: CurrentUser, role: int) -> dict[str, Any]:
    payload = join_payload(
        meeting_number=session.get("zoom_meeting_number") or "0",
        password=session.get("zoom_password") or "",
        display_name=user.display_name,
        email=f"{user.username}@demo.uda.local",
        role=role,
        staff_id=_staff_id(user),
        zak=_host_zak(session) if role == 1 else None,
    )
    payload["mock"] = bool(session.get("zoom_mock", settings.demo_mode))
    return payload


def _record_attendance(session: dict[str, Any], user: CurrentUser, zoom_role: str) -> None:
    session.setdefault("attendance", []).append(
        {
            "username": user.username,
            "employee_id": _staff_id(user),
            "display_name": user.display_name,
            "zoom_role": zoom_role,
            "joined_at": _now(),
        }
    )


def _mark_awaiting(session: dict[str, Any], reason: str) -> None:
    if session["status"] in _TERMINAL:
        return
    session["status"] = "AWAITING_CONCLUSION"
    session["lifecycle_phase"] = "closure"
    session["ended_at"] = session.get("ended_at") or _now()
    session["ended_reason"] = reason
    for member in session.get("members", []):
        if isinstance(member, dict) and member.get("presence") == "IN_ROOM":
            member["presence"] = "LEFT"


def _write_chart(state: dict[str, Any], session: dict[str, Any], user: CurrentUser) -> None:
    entry = {
        "consultation_id": session["id"],
        "study_id": session["study_id"],
        "conclusion": session.get("conclusion") or "",
        "signed_by": user.username,
        "employee_id": _staff_id(user),
        "digital_signature": session.get("digital_signature"),
        "signed_at": session.get("signed_at"),
    }
    session["emr_entry"] = entry
    state.setdefault("chart_addenda", {}).setdefault(session["study_id"], []).append(entry)


def _apply_conclusion(
    state: dict[str, Any],
    consultation_id: str,
    user: CurrentUser,
    *,
    conclusion: str,
    step_up_password: str,
    agreement: str,
    agreement_note: str,
) -> dict[str, Any]:
    session = _find_session(state, consultation_id)
    if not _is_chair(session, user):
        raise HTTPException(status_code=403, detail="Only the Chairman can sign the consultation")
    if session["status"] in {"FINALIZED", "COMPLETED", "CANCELLED"}:
        raise HTTPException(status_code=409, detail="Already finalized")
    if session["status"] not in {"LIVE", "AWAITING_CONCLUSION"}:
        raise HTTPException(status_code=409, detail="Consultation is not ready for conclusion")
    verify_demo_password(step_up_password or "")
    normalized = agreement.strip().capitalize()
    mapping = {"agree": "Agree", "partial": "Partial", "disagree": "Disagree"}
    normalized = mapping.get(agreement.strip().lower(), normalized)
    if normalized not in {"Agree", "Partial", "Disagree"}:
        normalized = "Agree"
    member = _require_member(session, user)
    member["agreement_with_ai"] = normalized
    member["agreement_note"] = agreement_note
    session.setdefault("agreements", {})[user.username] = {
        "agreement": normalized,
        "note": agreement_note,
    }
    signed_at = _now()
    text = conclusion.strip()
    session["conclusion"] = text
    session["consensus_notes"] = text
    session["digital_signature"] = _chart_signature(session["id"], user.username, signed_at, text)
    session["signed_by"] = user.username
    session["signed_at"] = signed_at
    session["status"] = "COMPLETED"
    session["lifecycle_phase"] = "closure"
    session["ended_at"] = session.get("ended_at") or signed_at
    for person in session.get("members", []):
        if isinstance(person, dict) and person.get("presence") == "IN_ROOM":
            person["presence"] = "LEFT"
    _write_chart(state, session, user)
    meeting_number = str(session.get("zoom_meeting_number") or "")
    return {"session": _public_session(session), "meeting_number": meeting_number}


@router.get("")
def list_Consultation(_user: CurrentUser = Depends(get_current_user)):
    return [_public_session(item) for item in store.snapshot()["Consultation"]]


@router.post("/zoom/webhook")
async def zoom_webhook(request: Request):
    """Zoom meeting.ended → room moves to awaiting the Chairman's signed conclusion."""
    raw = await request.body()
    secret = settings.zoom_webhook_secret
    if secret:
        provided = request.headers.get("x-uda-webhook-token") or ""
        expected = hmac.new(secret.encode("utf-8"), raw, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(provided, expected):
            raise HTTPException(status_code=401, detail="Invalid webhook signature")
    elif not settings.demo_mode:
        raise HTTPException(status_code=401, detail="Webhook secret is not configured")

    try:
        body = json.loads(raw.decode() or "{}")
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    event = str(body.get("event") or "")
    if event != "meeting.ended":
        return {"handled": False, "event": event}

    payload = body.get("payload") if isinstance(body.get("payload"), dict) else {}
    obj = payload.get("object") if isinstance(payload, dict) else None
    meeting_id = ""
    if isinstance(obj, dict) and obj.get("id") is not None:
        meeting_id = str(obj["id"])
    else:
        for key in ("meeting_id", "meeting_number", "id"):
            if body.get(key) is not None:
                meeting_id = str(body[key])
                break
    if not meeting_id:
        return {"handled": False, "reason": "missing meeting id"}

    def write(state):
        session = _find_by_meeting(state, meeting_id)
        if not session:
            return None
        if session["status"] != "LIVE":
            return _public_session(session)
        _mark_awaiting(session, "webhook")
        return _public_session(session)

    result = store.mutate(write)
    if result and result.get("status") == "AWAITING_CONCLUSION":
        store.audit("CONSULT_WEBHOOK_ENDED", "zoom", result["id"])
        await consultation_hub.broadcast(
            result["id"],
            "session.status",
            {"status": result["status"], "consultation": result},
        )
    return {"handled": bool(result), "consultation": result}


@router.get("/{consultation_id}")
def get_consultation(consultation_id: str, _user: CurrentUser = Depends(get_current_user)):
    def read(state):
        return _public_session(_find_session(state, consultation_id))

    return store.mutate(read)


@router.post("")
def create_consultation(
    body: CreateConsultationRequest,
    user: CurrentUser = Depends(get_current_user),
):
    if user.role not in _CLINICIANS:
        raise HTTPException(
            status_code=403,
            detail="Only a radiologist can request a consultation. The standing chairman can open an emergency room for a Critical study.",
        )

    def write(state):
        study = _study_record(state, body.study_id)
        if not study:
            raise HTTPException(status_code=404, detail="Study not found")
        if user.role == "physician" and study.get("status") != "Critical":
            raise HTTPException(
                status_code=403,
                detail="The standing chairman can only open a room for a Critical study",
            )
        profile = _user_by_id(state, user.get("id")) or dict(user)
        consultation_id = _next_id(state)
        session = empty_session(
            consultation_id=consultation_id,
            study_id=body.study_id,
            trigger_reason=body.trigger_reason.strip(),
            requested_by_id=profile["id"],
            members=[_member_from_user(profile, "Requester")],
        )
        session["created_at"] = _now()
        meeting = create_meeting(topic=f"UDA-StrokeSeg consultation {consultation_id} · {body.study_id}")
        session["zoom_mock"] = bool(meeting.get("mock", settings.demo_mode))
        session["zoom_meeting_number"] = str(meeting["id"])
        session["zoom_password"] = meeting.get("password") or ""
        session["zoom_zak"] = meeting.get("zak")
        session["zoom_start_url"] = meeting.get("start_url")
        session["zoom_join_url"] = meeting.get("join_url")
        state["Consultation"].insert(0, session)
        return _public_session(session)

    result = store.mutate(write)
    store.audit("CONSULT_CREATE", f"{user.username}|{_staff_id(user)}", result["id"])
    return result


@router.post("/{consultation_id}/assign")
async def assign_consultation(
    consultation_id: str,
    body: AssignConsultationRequest,
    user: CurrentUser = Depends(get_current_user),
):
    def write(state):
        session = _find_session(state, consultation_id)
        emergency = _is_emergency_self_assign(user, session, state, body.chairman_user_id)
        if not _can_assign(user) and not emergency:
            raise HTTPException(
                status_code=403,
                detail="Only the Head of Department can assign the Chairman",
            )
        if session["status"] not in _ASSIGNABLE:
            raise HTTPException(status_code=409, detail="Consultation can no longer be assigned")

        chairman = _user_by_id(state, body.chairman_user_id)
        if not chairman or chairman.get("role") == "it":
            raise HTTPException(status_code=400, detail="Chairman must be a clinician")

        members: list[dict[str, Any]] = []
        seen: set[str] = set()

        def add(profile: dict[str, Any], role: RoleInSession) -> None:
            if profile["id"] in seen:
                return
            if profile.get("role") == "it":
                raise HTTPException(status_code=400, detail="IT accounts cannot join a consultation")
            seen.add(profile["id"])
            members.append(_member_from_user(profile, role))

        add(chairman, "Chair")
        for participant_id in body.participant_user_ids:
            profile = _user_by_id(state, participant_id)
            if not profile:
                raise HTTPException(status_code=400, detail=f"Unknown participant {participant_id}")
            add(profile, "Member")
        requester_id = session.get("requested_by_id")
        if requester_id:
            requester = _user_by_id(state, requester_id)
            if requester:
                add(requester, "Member")

        session["members"] = members
        session["lead_chair_id"] = chairman["id"]
        session["status"] = "ASSIGNED"
        session["lifecycle_phase"] = "assignment"
        session["assigned_by"] = user.username
        session["assigned_at"] = _now()

        for member in members:
            role_label = "Chairman (host)" if member["role_in_session"] == "Chair" else "Participant"
            _notify(
                state,
                recipient=member["username"],
                title=f"Consultation {session['id']} assigned",
                body=(
                    f"You are the {role_label} for {session['study_id']}. "
                    f"Open Consultation and enter room {session['id']}."
                ),
                consultation_id=session["id"],
            )
        return _public_session(session)

    result = store.mutate(write)
    store.audit("CONSULT_ASSIGN", f"{user.username}|{_staff_id(user)}", consultation_id)
    await consultation_hub.broadcast(
        consultation_id,
        "session.status",
        {"status": result["status"], "consultation": result},
    )
    return result


@router.post("/{consultation_id}/lobby")
async def enter_lobby(consultation_id: str, user: CurrentUser = Depends(get_current_user)):
    def write(state):
        session = _find_session(state, consultation_id)
        _require_assigned(session)
        member = _require_member(session, user)
        member["presence"] = "IN_LOBBY"
        if session["status"] in {"SCHEDULED", "ASSIGNED", "DRAFT"}:
            session["status"] = "WAITING"
            session["lifecycle_phase"] = "assignment"
        return _public_session(session)

    result = store.mutate(write)
    store.audit("CONSULT_LOBBY", f"{user.username}|{_staff_id(user)}", consultation_id)
    await consultation_hub.broadcast(
        consultation_id,
        "member.presence",
        {"consultation": result},
    )
    await consultation_hub.broadcast(consultation_id, "session.status", {"status": result["status"]})
    return result


@router.post("/{consultation_id}/start")
async def start_consultation(consultation_id: str, user: CurrentUser = Depends(get_current_user)):
    def write(state):
        session = _find_session(state, consultation_id)
        _require_assigned(session)
        if not _is_chair(session, user):
            raise HTTPException(status_code=403, detail="Only the Chairman can start")
        member = _require_member(session, user)
        session["status"] = "LIVE"
        session["lifecycle_phase"] = "active"
        session["started_at"] = session.get("started_at") or _now()
        member["presence"] = "IN_ROOM"
        member["joined_at"] = _now()
        _record_attendance(session, user, "host")
        zoom = _zoom_for(session, user, 1)
        return {"session": _public_session(session), "zoom": zoom}

    result = store.mutate(write)
    store.audit("CONSULT_START", f"{user.username}|{_staff_id(user)}", consultation_id)
    await consultation_hub.broadcast(
        consultation_id,
        "session.status",
        {"status": "LIVE", "consultation": result["session"]},
    )
    return result


@router.post("/{consultation_id}/join")
async def join_consultation(consultation_id: str, user: CurrentUser = Depends(get_current_user)):
    def write(state):
        session = _find_session(state, consultation_id)
        _require_assigned(session)
        member = _require_member(session, user)
        if session["status"] != "LIVE" and not _is_chair(session, user):
            member["presence"] = "IN_LOBBY"
            if session["status"] in {"ASSIGNED", "SCHEDULED"}:
                session["status"] = "WAITING"
            return {"session": _public_session(session), "zoom": None, "waiting": True}

        if session["status"] != "LIVE" and _is_chair(session, user):
            session["status"] = "LIVE"
            session["lifecycle_phase"] = "active"
            session["started_at"] = session.get("started_at") or _now()

        is_host = _is_chair(session, user)
        member["presence"] = "IN_ROOM"
        member["joined_at"] = _now()
        role = 1 if is_host else 0
        _record_attendance(session, user, "host" if is_host else "participant")
        zoom = _zoom_for(session, user, role)
        return {"session": _public_session(session), "zoom": zoom, "waiting": False}

    result = store.mutate(write)
    store.audit("CONSULT_JOIN", f"{user.username}|{_staff_id(user)}", consultation_id)
    await consultation_hub.broadcast(
        consultation_id,
        "member.presence",
        {"consultation": result["session"]},
    )
    if result["session"]["status"] == "LIVE":
        await consultation_hub.broadcast(
            consultation_id,
            "session.status",
            {"status": "LIVE", "consultation": result["session"]},
        )
    return result


@router.post("/{consultation_id}/leave")
async def leave_consultation(consultation_id: str, user: CurrentUser = Depends(get_current_user)):
    def write(state):
        session = _find_session(state, consultation_id)
        member = _require_member(session, user)
        member["presence"] = "LEFT"
        return _public_session(session)

    result = store.mutate(write)
    store.audit("CONSULT_LEAVE", f"{user.username}|{_staff_id(user)}", consultation_id)
    await consultation_hub.broadcast(
        consultation_id,
        "member.presence",
        {"consultation": result},
    )
    return result


@router.post("/{consultation_id}/end")
async def end_consultation(consultation_id: str, user: CurrentUser = Depends(get_current_user)):
    def write(state):
        session = _find_session(state, consultation_id)
        if not _is_chair(session, user):
            raise HTTPException(status_code=403, detail="Only the Chairman can end the meeting")
        if session["status"] in _TERMINAL:
            return {"session": _public_session(session), "meeting_number": ""}
        if session["status"] == "AWAITING_CONCLUSION":
            return {
                "session": _public_session(session),
                "meeting_number": str(session.get("zoom_meeting_number") or ""),
            }
        if session["status"] != "LIVE":
            raise HTTPException(status_code=409, detail="Consultation is not live")
        _mark_awaiting(session, "chair_end")
        return {
            "session": _public_session(session),
            "meeting_number": str(session.get("zoom_meeting_number") or ""),
        }

    result = store.mutate(write)
    if result.get("meeting_number"):
        end_meeting(str(result["meeting_number"]))
    store.audit("CONSULT_END", f"{user.username}|{_staff_id(user)}", consultation_id)
    await consultation_hub.broadcast(
        consultation_id,
        "session.status",
        {"status": result["session"]["status"], "consultation": result["session"]},
    )
    return result["session"]


@router.post("/{consultation_id}/invite")
async def invite_member(
    consultation_id: str,
    body: InviteMemberRequest,
    user: CurrentUser = Depends(get_current_user),
):
    """Chairman or Head of Department adds an on-duty doctor to an open room."""

    def write(state):
        session = _find_session(state, consultation_id)
        if session["status"] in _TERMINAL or session["status"] in {"PENDING_ASSIGNMENT", "AWAITING_CONCLUSION"}:
            raise HTTPException(status_code=409, detail="This room is not open for new invitations")
        if not _is_chair(session, user) and not _can_assign(user):
            raise HTTPException(status_code=403, detail="Only the Chairman or Head of Department can invite")
        profile = _user_by_id(state, body.user_id)
        if not profile or profile.get("role") == "it":
            raise HTTPException(status_code=400, detail="Choose an on-duty clinician")
        existing = next(
            (member for member in session.get("members", []) if member.get("user_id") == profile["id"]),
            None,
        )
        if existing:
            return _public_session(session)
        session.setdefault("members", []).append(_member_from_user(profile, "Member"))
        _notify(
            state,
            recipient=profile["username"],
            title=f"Invited to consultation {session['id']}",
            body=f"You are invited to {session['study_id']}. Open Consultation and join room {session['id']}.",
            consultation_id=session["id"],
        )
        return _public_session(session)

    result = store.mutate(write)
    store.audit("CONSULT_INVITE", f"{user.username}|{_staff_id(user)}", consultation_id)
    await consultation_hub.broadcast(
        consultation_id,
        "member.presence",
        {"consultation": result},
    )
    return result


@router.post("/{consultation_id}/discussion")
async def post_discussion(
    consultation_id: str,
    body: DiscussionRequest,
    user: CurrentUser = Depends(get_current_user),
):
    text = body.text.strip()

    def write(state):
        session = _find_session(state, consultation_id)
        if session["status"] in _TERMINAL:
            raise HTTPException(status_code=409, detail="Discussion is closed")
        member = _find_member(session, user)
        if not member:
            raise HTTPException(status_code=403, detail="Not a consultation member")
        entry = {
            "id": f"d-{session['id']}-{len(session.get('discussion') or []) + 1}",
            "author": user.display_name,
            "username": user.username,
            "role_in_session": member.get("role_in_session") or "Member",
            "employee_id": _staff_id(user),
            "text": text,
            "sent_at": _now(),
        }
        session.setdefault("discussion", []).append(entry)
        return {"entry": entry, "session": _public_session(session)}

    result = store.mutate(write)
    store.audit("CONSULT_NOTE", f"{user.username}|{_staff_id(user)}", consultation_id)
    await consultation_hub.broadcast(
        consultation_id,
        "discussion.message",
        {"message": result["entry"], "consultation": result["session"]},
    )
    return result["entry"]


@router.post("/{consultation_id}/agreement")
async def save_agreement(
    consultation_id: str,
    body: AgreementRequest,
    user: CurrentUser = Depends(get_current_user),
):
    normalized = _AGREEMENTS.get(body.agreement.strip().lower(), "")
    if not normalized:
        raise HTTPException(status_code=400, detail="Invalid agreement value")
    if normalized in _NOTE_REQUIRED and not body.note.strip():
        raise HTTPException(status_code=400, detail="Note required for this vote")

    def write(state):
        session = _find_session(state, consultation_id)
        if session["status"] != "LIVE":
            raise HTTPException(status_code=409, detail="Voting is only open while the room is live")
        member = _require_member(session, user)
        member["agreement_with_ai"] = normalized
        member["agreement_note"] = body.note
        session.setdefault("agreements", {})[user.username] = {
            "agreement": normalized,
            "note": body.note,
        }
        return _public_session(session)

    result = store.mutate(write)
    store.audit("CONSULT_AGREEMENT", f"{user.username}|{_staff_id(user)}", consultation_id)
    await consultation_hub.broadcast(consultation_id, "poll.updated", {"consultation": result})
    return result


@router.post("/{consultation_id}/conclusion")
async def save_conclusion(
    consultation_id: str,
    body: ConclusionRequest,
    user: CurrentUser = Depends(get_current_user),
):
    def write(state):
        return _apply_conclusion(
            state,
            consultation_id,
            user,
            conclusion=body.conclusion,
            step_up_password=body.step_up_password,
            agreement=body.agreement,
            agreement_note=body.agreement_note,
        )

    result = store.mutate(write)
    end_meeting(str(result.get("meeting_number") or ""))
    store.audit("CONSULT_CONCLUSION", f"{user.username}|{_staff_id(user)}", consultation_id)
    await consultation_hub.broadcast(
        consultation_id,
        "session.status",
        {"status": "COMPLETED", "consultation": result["session"]},
    )
    return result["session"]


@router.post("/{consultation_id}/consensus")
async def save_consensus(
    consultation_id: str,
    body: ConsensusRequest,
    user: CurrentUser = Depends(get_current_user),
):
    def write(state):
        return _apply_conclusion(
            state,
            consultation_id,
            user,
            conclusion=body.notes,
            step_up_password=body.step_up_password,
            agreement=body.agreement,
            agreement_note=body.agreement_note,
        )

    result = store.mutate(write)
    end_meeting(str(result.get("meeting_number") or ""))
    store.audit("CONSULT_CONSENSUS", f"{user.username}|{_staff_id(user)}", consultation_id)
    await consultation_hub.broadcast(
        consultation_id,
        "session.status",
        {"status": "COMPLETED", "consultation": result["session"]},
    )
    return result["session"]


@router.websocket("/{consultation_id}/ws")
async def consultation_ws(websocket: WebSocket, consultation_id: str):
    token = websocket.query_params.get("token") or ""
    try:
        role, username = parse_token(token)
    except Exception:
        await websocket.close(code=4401)
        return

    def find_user(state):
        for user in state["users"]:
            if user["username"] == username and user["role"] == role:
                return user
        return None

    user = store.mutate(find_user)
    if not user:
        await websocket.close(code=4401)
        return

    await consultation_hub.connect(consultation_id, websocket)
    try:
        snapshot = store.mutate(lambda state: _public_session(_find_session(state, consultation_id)))
        await websocket.send_text(
            json.dumps({"event": "session.snapshot", "payload": {"consultation": snapshot}})
        )
    except HTTPException:
        await websocket.close(code=4404)
        await consultation_hub.disconnect(consultation_id, websocket)
        return

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                message = json.loads(raw)
            except json.JSONDecodeError:
                continue
            event = message.get("event")
            payload = message.get("payload") or {}

            if event == "canvas.viewport":

                def write_viewport(state):
                    session = _find_session(state, consultation_id)
                    if session["status"] != "LIVE":
                        return None
                    viewport = {
                        "slice": int(payload.get("slice", session["viewport"]["slice"])),
                        "zoom": float(payload.get("zoom", session["viewport"]["zoom"])),
                        "pan_x": float(payload.get("pan_x", session["viewport"]["pan_x"])),
                        "pan_y": float(payload.get("pan_y", session["viewport"]["pan_y"])),
                    }
                    session["viewport"] = viewport
                    return {
                        "viewport": viewport,
                        "actor": username,
                        "display_name": user["display_name"],
                    }

                updated = store.mutate(write_viewport)
                if updated:
                    await consultation_hub.broadcast(consultation_id, "canvas.viewport", updated)

            elif event == "canvas.cursor":
                await consultation_hub.broadcast(
                    consultation_id,
                    "canvas.cursor",
                    {
                        "x": payload.get("x", 0),
                        "y": payload.get("y", 0),
                        "actor": username,
                        "display_name": user["display_name"],
                        "initials": user.get("initials", "??"),
                    },
                )
    except WebSocketDisconnect:
        await consultation_hub.disconnect(consultation_id, websocket)
    except Exception:
        await consultation_hub.disconnect(consultation_id, websocket)

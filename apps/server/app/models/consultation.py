"""ERD entities: Consultationession + ConsultationMember (demo dict shape)."""

from __future__ import annotations

from typing import Any, Literal

ConsultationStatus = Literal[
    "DRAFT",
    "PENDING_ASSIGNMENT",
    "ASSIGNED",
    "SCHEDULED",
    "WAITING",
    "LIVE",
    "AWAITING_CONCLUSION",
    "COMPLETED",
    "FINALIZED",
    "CANCELLED",
    "ENDED_WITHOUT_CONSENSUS",
]

LifecyclePhase = Literal["initialization", "assignment", "active", "closure"]
RoleInSession = Literal["Chair", "Member", "Requester"]
MemberPresence = Literal["INVITED", "IN_LOBBY", "IN_ROOM", "LEFT"]
AgreementWithAI = Literal["Agree", "Partial", "Disagree", ""]


def empty_member(
    *,
    user_id: str,
    username: str,
    display_name: str,
    role_in_session: RoleInSession,
    initials: str = "??",
    employee_id: str = "",
) -> dict[str, Any]:
    return {
        "user_id": user_id,
        "username": username,
        "display_name": display_name,
        "employee_id": employee_id,
        "initials": initials,
        "role_in_session": role_in_session,
        "presence": "INVITED",
        "joined_at": None,
        "agreement_with_ai": "",
        "agreement_note": "",
        "comments": "",
        "individual_mask_id": None,
    }


def empty_session(
    *,
    consultation_id: str,
    study_id: str,
    trigger_reason: str,
    requested_by_id: str,
    members: list[dict[str, Any]],
    lead_chair_id: str = "",
) -> dict[str, Any]:
    return {
        "id": consultation_id,
        "study_id": study_id,
        "status": "PENDING_ASSIGNMENT",
        "lifecycle_phase": "initialization",
        "trigger_reason": trigger_reason,
        "requested_by_id": requested_by_id,
        "lead_chair_id": lead_chair_id,
        "conclusion": "",
        "digital_signature": None,
        "signed_by": None,
        "signed_at": None,
        "consensus_notes": "",
        "consensus_mask_id": None,
        "members": members,
        "agreements": {},
        "attendance": [],
        "discussion": [],
        "started_at": None,
        "ended_at": None,
        "created_at": None,
        "zoom_meeting_number": None,
        "zoom_password": None,
        "zoom_zak": None,
        "zoom_start_url": None,
        "zoom_join_url": None,
        "zoom_mock": True,
        "viewport": {"slice": 16, "zoom": 1, "pan_x": 0, "pan_y": 0},
    }

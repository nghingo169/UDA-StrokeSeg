"""In-memory seed + mutable state for lecturer full-flow demos.

Mirrors the prototype cases in apps/web/src/App.tsx so FE and Swagger stay aligned.
"""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from threading import Lock
from typing import Any

DEMO_PASSWORD = "Pass@123"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


_STAFF_BY_USER = {
    "u-rad-011": "RAD-011",
    "u-rad-014": "RAD-014",
    "u-phy-024": "PHY-024",
    "u-hod-003": "HOD-003",
    "u-it-008": "IT-008",
}


def _hydrate_Consultation(state: dict[str, Any]) -> dict[str, Any]:
    closed = {"FINALIZED", "COMPLETED", "AWAITING_CONCLUSION"}
    for item in state.get("Consultation", []):
        if item.get("status") == "PENDING_ASSIGNMENT" or not item.get("lead_chair_id"):
            phase = "initialization"
        elif item.get("status") in closed:
            phase = "closure"
        elif item.get("status") == "LIVE":
            phase = "active"
        else:
            phase = "assignment"
        item.setdefault("lifecycle_phase", phase)
        item.setdefault("requested_by_id", "u-rad-011")
        item.setdefault("conclusion", item.get("consensus_notes") or "")
        item.setdefault("digital_signature", None)
        item.setdefault("signed_by", None)
        item.setdefault("signed_at", None)
        item.setdefault("attendance", [])
        item.setdefault("discussion", [])
        item.setdefault("lead_chair_id", item.get("lead_chair_id") or "")
        meeting_number = item.get("zoom_meeting_number")
        if meeting_number and not item.get("zoom_zak"):
            item["zoom_zak"] = f"mock-zak-{meeting_number}"
        if item.get("status") in {"FINALIZED", "COMPLETED"} and not item.get("digital_signature"):
            item["digital_signature"] = "sig-v1:seed"
            item["signed_by"] = item.get("signed_by") or "thomas.nguyen"
            item["signed_at"] = item.get("signed_at") or item.get("ended_at")
            item["lifecycle_phase"] = "closure"
        for member in item.get("members", []):
            member.setdefault(
                "employee_id",
                _STAFF_BY_USER.get(member.get("user_id", ""), ""),
            )
    state.setdefault("email_log", [])
    state.setdefault("chart_addenda", {})
    return state


def _seed() -> dict[str, Any]:
    users = [
        {
            "id": "u-rad-011",
            "username": "lena.morgan",
            "display_name": "Dr. Lena Morgan",
            "employee_id": "RAD-011",
            "role": "radiologist",
            "initials": "LA",
        },
        {
            "id": "u-rad-014",
            "username": "priya.shah",
            "display_name": "Dr. Priya Shah",
            "employee_id": "RAD-014",
            "role": "radiologist",
            "initials": "PS",
        },
        {
            "id": "u-phy-024",
            "username": "maya.harris",
            "display_name": "Dr. Maya Harris",
            "employee_id": "PHY-024",
            "role": "physician",
            "initials": "MH",
        },
        {
            "id": "u-hod-003",
            "username": "thomas.nguyen",
            "display_name": "Dr. Thomas Nguyen",
            "employee_id": "HOD-003",
            "role": "hod",
            "initials": "TN",
        },
        {
            "id": "u-it-008",
            "username": "alex.nguyen",
            "display_name": "Alex Nguyen",
            "employee_id": "IT-008",
            "role": "it",
            "initials": "QT",
        },
    ]

    studies = [
        {
            "id": "AIS-240913-084",
            "patient": "BN-7A42",
            "age": 67,
            "sex": "Male",
            "onset": "01:38",
            "received": "08:42",
            "sla": 11,
            "status": "Critical",
            "case_state": "AwaitingReview",
            "volume": 18.6,
            "side": "Left hemisphere",
            "territory": "MCA",
            "nihss": 14,
            "clusters": 2,
            "confidence": 0.91,
            "dice_score": 0.86,
            "threshold": 0.45,
            "missing_inputs": [],
            "assignee": "Dr. Lena Morgan",
            "progress": "waiting",
            "suggestion_draft": (
                "Acute ischemic infarct in the left hemisphere, MCA territory. "
                "Correlate with clinical presentation before release."
            ),
            "mask_version": "System draft 01",
            "model_version": "v2.4.1",
        },
        {
            "id": "AIS-240913-079",
            "patient": "BN-3C91",
            "age": 58,
            "sex": "Female",
            "onset": "02:15",
            "received": "08:31",
            "sla": 18,
            "status": "Critical",
            "case_state": "AwaitingReview",
            "volume": 7.2,
            "side": "Right hemisphere",
            "territory": "PCA",
            "nihss": 9,
            "clusters": 1,
            "confidence": 0.84,
            "dice_score": 0.79,
            "threshold": 0.45,
            "missing_inputs": ["Clinical onset time unverified"],
            "assignee": "Dr. Priya Shah",
            "progress": "in_progress",
            "suggestion_draft": (
                "Acute ischemic infarct in the right hemisphere, PCA territory. "
                "Correlate with clinical presentation before release."
            ),
            "mask_version": "System draft 01",
            "model_version": "v2.4.1",
        },
        {
            "id": "AIS-240913-077",
            "patient": "BN-8D16",
            "age": 72,
            "sex": "Female",
            "onset": "Unknown",
            "received": "08:17",
            "sla": 24,
            "status": "Priority",
            "case_state": "AwaitingReview",
            "volume": 3.8,
            "side": "Left hemisphere",
            "territory": "ACA",
            "nihss": 6,
            "clusters": 3,
            "confidence": 0.72,
            "dice_score": 0.68,
            "threshold": 0.45,
            "missing_inputs": ["Symptom onset unknown", "Prior imaging unread"],
            "assignee": "Dr. Lena Morgan",
            "progress": "overdue",
            "suggestion_draft": (
                "Acute ischemic infarct in the left hemisphere, ACA territory. "
                "Correlate with clinical presentation before release."
            ),
            "mask_version": "System draft 01",
            "model_version": "v2.4.1",
        },
        {
            "id": "AIS-240913-071",
            "patient": "BN-2F08",
            "age": 49,
            "sex": "Male",
            "onset": "03:02",
            "received": "07:54",
            "sla": 35,
            "status": "Routine",
            "case_state": "AwaitingReview",
            "volume": 0.0,
            "side": "Undetermined",
            "territory": "-",
            "nihss": 4,
            "clusters": 0,
            "confidence": 0.41,
            "dice_score": 0.0,
            "threshold": 0.45,
            "missing_inputs": ["Empty mask - full manual read required"],
            "assignee": "Dr. Noah Williams",
            "progress": "waiting",
            "suggestion_draft": (
                "Empty automated mask. Full manual review required before documentation."
            ),
            "mask_version": "System draft 01",
            "model_version": "v2.4.1",
        },
    ]

    signed = [
        {
            "id": "AIS-240913-063",
            "patient": "BN-1E74",
            "age": 61,
            "sex": "Male",
            "signed": "08:18",
            "signer": "Dr. Lena Morgan",
            "treatment": "Decision pending",
            "volume": 12.4,
            "side": "Left hemisphere",
            "territory": "MCA",
            "nihss": 12,
            "status": "Critical",
            "case_state": "SignedOff",
            "disposition": "accepted_unchanged",
            "clinical_note": "Restricted diffusion in left MCA territory. No hemorrhage.",
        },
        {
            "id": "AIS-240913-058",
            "patient": "BN-5B22",
            "age": 55,
            "sex": "Female",
            "signed": "07:56",
            "signer": "Dr. Priya Shah",
            "treatment": "Consulted",
            "volume": 6.8,
            "side": "Right hemisphere",
            "territory": "PCA",
            "nihss": 8,
            "status": "Critical",
            "case_state": "SignedOff",
            "disposition": "accepted_with_adjustment",
            "clinical_note": "Adjusted mask border near PCA territory; findings concordant.",
        },
        {
            "id": "AIS-240913-041",
            "patient": "BN-9C04",
            "age": 70,
            "sex": "Female",
            "signed": "06:42",
            "signer": "Dr. Lena Morgan",
            "treatment": "Monitoring",
            "volume": 2.1,
            "side": "Left hemisphere",
            "territory": "ACA",
            "nihss": 5,
            "status": "Priority",
            "case_state": "SignedOff",
            "disposition": "accepted_unchanged",
            "clinical_note": "Small ACA territory lesion; clinical correlation advised.",
        },
    ]

    state = {
        "users": users,
        "studies": studies,
        "signed_studies": signed,
        "notes": {},
        "disposition_notes": {},
        "masks": {
            "AIS-240913-084": {
                "study_id": "AIS-240913-084",
                "version": "System draft 01",
                "revised": False,
                "volume_ml": 18.6,
                "revision_reason": None,
            }
        },
        "feedback": {},
        "Consultation": [
            {
                "id": "CON-0913-018",
                "study_id": "AIS-240913-084",
                "status": "PENDING_ASSIGNMENT",
                "lifecycle_phase": "initialization",
                "trigger_reason": "Acute complex MCA stroke - multidisciplinary review requested",
                "requested_by_id": "u-rad-011",
                "lead_chair_id": "",
                "conclusion": "",
                "digital_signature": None,
                "signed_by": None,
                "signed_at": None,
                "consensus_notes": "",
                "consensus_mask_id": None,
                "agreements": {},
                "attendance": [],
                "started_at": None,
                "ended_at": None,
                "created_at": _now(),
                "zoom_meeting_number": "9000913018",
                "zoom_password": "uda0918",
                "zoom_zak": "mock-zak-9000913018",
                "zoom_start_url": "https://zoom.us/s/9000913018?zak=mock",
                "zoom_join_url": "https://zoom.us/j/9000913018?pwd=mock",
                "zoom_mock": True,
                "viewport": {"slice": 14, "zoom": 1, "pan_x": 0, "pan_y": 0},
                "members": [
                    {
                        "user_id": "u-rad-011",
                        "username": "lena.morgan",
                        "display_name": "Dr. Lena Morgan",
                        "employee_id": "RAD-011",
                        "initials": "LA",
                        "role_in_session": "Requester",
                        "presence": "INVITED",
                        "joined_at": None,
                        "agreement_with_ai": "",
                        "agreement_note": "",
                        "comments": "",
                        "individual_mask_id": None,
                    }
                ],
            },
            {
                "id": "CON-0913-012",
                "study_id": "AIS-240913-058",
                "status": "WAITING",
                "trigger_reason": "Clinical–imaging mismatch, high hemorrhagic transformation risk",
                "lead_chair_id": "u-hod-003",
                "consensus_notes": "",
                "consensus_mask_id": None,
                "agreements": {},
                "started_at": None,
                "ended_at": None,
                "created_at": _now(),
                "zoom_meeting_number": "9000913012",
                "zoom_password": "uda0913",
                "zoom_start_url": "https://zoom.us/s/9000913012?zak=mock",
                "zoom_join_url": "https://zoom.us/j/9000913012?pwd=mock",
                "zoom_mock": True,
                "viewport": {"slice": 16, "zoom": 1, "pan_x": 0, "pan_y": 0},
                "members": [
                    {
                        "user_id": "u-hod-003",
                        "username": "thomas.nguyen",
                        "display_name": "Dr. Thomas Nguyen",
                        "initials": "TN",
                        "role_in_session": "Chair",
                        "presence": "INVITED",
                        "joined_at": None,
                        "agreement_with_ai": "",
                        "agreement_note": "",
                        "comments": "",
                        "individual_mask_id": None,
                    },
                    {
                        "user_id": "u-rad-011",
                        "username": "lena.morgan",
                        "display_name": "Dr. Lena Morgan",
                        "initials": "LA",
                        "role_in_session": "Member",
                        "presence": "INVITED",
                        "joined_at": None,
                        "agreement_with_ai": "",
                        "agreement_note": "",
                        "comments": "",
                        "individual_mask_id": None,
                    },
                    {
                        "user_id": "u-phy-024",
                        "username": "maya.harris",
                        "display_name": "Dr. Maya Harris",
                        "initials": "MH",
                        "role_in_session": "Member",
                        "presence": "INVITED",
                        "joined_at": None,
                        "agreement_with_ai": "",
                        "agreement_note": "",
                        "comments": "",
                        "individual_mask_id": None,
                    },
                    {
                        "user_id": "u-rad-014",
                        "username": "priya.shah",
                        "display_name": "Dr. Priya Shah",
                        "initials": "PS",
                        "role_in_session": "Member",
                        "presence": "INVITED",
                        "joined_at": None,
                        "agreement_with_ai": "",
                        "agreement_note": "",
                        "comments": "",
                        "individual_mask_id": None,
                    },
                ],
            },
            {
                "id": "CON-0913-009",
                "study_id": "AIS-240913-041",
                "status": "FINALIZED",
                "trigger_reason": "Wide lesion - panel consensus requested",
                "lead_chair_id": "u-hod-003",
                "consensus_notes": "Panel agrees with adjusted findings.",
                "consensus_mask_id": None,
                "agreements": {"agree": 3},
                "started_at": _now(),
                "ended_at": _now(),
                "created_at": _now(),
                "zoom_meeting_number": "9000913009",
                "zoom_password": "uda0909",
                "zoom_start_url": None,
                "zoom_join_url": "https://zoom.us/j/9000913009?pwd=mock",
                "zoom_mock": True,
                "viewport": {"slice": 12, "zoom": 1, "pan_x": 0, "pan_y": 0},
                "members": [
                    {
                        "user_id": "u-hod-003",
                        "username": "thomas.nguyen",
                        "display_name": "Dr. Thomas Nguyen",
                        "initials": "TN",
                        "role_in_session": "Chair",
                        "presence": "LEFT",
                        "joined_at": None,
                        "agreement_with_ai": "Agree",
                        "agreement_note": "",
                        "comments": "",
                        "individual_mask_id": None,
                    },
                    {
                        "user_id": "u-rad-011",
                        "username": "lena.morgan",
                        "display_name": "Dr. Lena Morgan",
                        "initials": "LA",
                        "role_in_session": "Member",
                        "presence": "LEFT",
                        "joined_at": None,
                        "agreement_with_ai": "Agree",
                        "agreement_note": "",
                        "comments": "",
                        "individual_mask_id": None,
                    },
                    {
                        "user_id": "u-phy-024",
                        "username": "maya.harris",
                        "display_name": "Dr. Maya Harris",
                        "initials": "MH",
                        "role_in_session": "Member",
                        "presence": "LEFT",
                        "joined_at": None,
                        "agreement_with_ai": "Agree",
                        "agreement_note": "",
                        "comments": "",
                        "individual_mask_id": None,
                    },
                ],
            },
        ],
        "roster": [
            {
                "name": "Dr. Lena Morgan",
                "status": True,
                "load": 4,
                "shift": "07:00–15:00",
            },
            {
                "name": "Dr. Priya Shah",
                "status": True,
                "load": 3,
                "shift": "07:00–15:00",
            },
            {
                "name": "Dr. Noah Williams",
                "status": False,
                "load": 0,
                "shift": "15:00–23:00",
            },
        ],
        "assignment_policies": [
            {
                "rule": "Critical study routing",
                "setting": "Least-loaded reader",
                "applies_to": "NIHSS ≥ 10",
                "escalation": "After 8 min",
                "status": "Active",
            },
            {
                "rule": "Standard assignment",
                "setting": "Round robin",
                "applies_to": "All other studies",
                "escalation": "After 15 min",
                "status": "Active",
            },
        ],
        "models": [
            {
                "version": "v2.5.0",
                "target_site": "Siemens 1.5T",
                "clinical_gate": "Pending",
                "technical_gate": "Approved",
                "status": "Awaiting review",
            },
            {
                "version": "v2.4.1",
                "target_site": "Multi-center",
                "clinical_gate": "Approved",
                "technical_gate": "Approved",
                "status": "Active",
            },
        ],
        "pacs_nodes": [
            {
                "ae_title": "ER_MRI_01",
                "host": "10.10.2.14",
                "port": 11112,
                "status": "healthy",
                "latency_ms": 24,
            },
            {
                "ae_title": "ER_MRI_02",
                "host": "10.10.2.18",
                "port": 11112,
                "status": "degraded",
                "latency_ms": 96,
            },
        ],
        "quarantine": [
            {
                "id": "INC-0913-027",
                "reason": "Missing mandatory sequence: FLAIR",
                "ae_title": "ER_MRI_02",
                "received": "08:29",
                "dicom_status": "0xC000",
            },
            {
                "id": "INC-0913-028",
                "reason": "SLA timeout · 184s",
                "ae_title": "worker_ai_02",
                "received": "08:41",
                "dicom_status": "SLA_TIMEOUT",
            },
        ],
        "audit": [
            {
                "ts": "08:41:54",
                "event": "SLA_TIMEOUT",
                "actor": "worker_ai_02",
                "resource": "TASK-028",
                "result": "FAILED",
            },
            {
                "ts": "08:18:02",
                "event": "SIGN_OFF",
                "actor": "lena.morgan",
                "resource": "AIS-240913-063",
                "result": "OK",
            },
        ],
        "notifications": [
            {
                "id": "n1",
                "title": "Critical study waiting",
                "body": "AIS-240913-084 · 11 min SLA remaining",
                "read": False,
            },
            {
                "id": "n2",
                "title": "Manual fallback active",
                "body": "AIS-240913-091 exceeded automated analysis SLA",
                "read": False,
            },
        ],
        "ops": {
            "ai_active": True,
            "suspend_reason": None,
            "fallback_queue": [
                {
                    "study_id": "AIS-240913-091",
                    "reason": "Automated analysis exceeded 180s",
                    "assignee": None,
                }
            ],
            "health": [
                {"name": "API Gateway", "value": "99.99%", "status": "healthy"},
                {"name": "Event Bus", "value": "12 msg/s", "status": "healthy"},
                {"name": "AI Workers", "value": "3 / 3", "status": "healthy"},
                {"name": "Object Storage", "value": "68%", "status": "healthy"},
                {"name": "PACS C-STORE", "value": "24 ms", "status": "healthy"},
            ],
        },
        "processing": {
            "study_id": "AIS-240913-091",
            "stage": "Segmenting lesion",
            "sla_remaining_sec": 94,
        },
        "created_at": _now(),
    }
    return _hydrate_Consultation(state)


class DemoStore:
    def __init__(self) -> None:
        self._lock = Lock()
        self._state = _seed()

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            return deepcopy(self._state)

    def reset(self) -> dict[str, Any]:
        with self._lock:
            self._state = _seed()
            return deepcopy(self._state)

    def mutate(self, fn) -> Any:
        with self._lock:
            return fn(self._state)

    def audit(self, event: str, actor: str, resource: str, result: str = "OK") -> None:
        with self._lock:
            self._state["audit"].insert(
                0,
                {
                    "ts": datetime.now().strftime("%H:%M:%S"),
                    "event": event,
                    "actor": actor,
                    "resource": resource,
                    "result": result,
                },
            )


store = DemoStore()

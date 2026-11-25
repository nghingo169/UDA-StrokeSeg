"""Consultation lifecycle against FastAPI TestClient (mock Zoom)."""

from fastapi.testclient import TestClient

from app.main import app
from app.demo_store import store

client = TestClient(app)
PASSWORD = "Pass@123"


def _token(username: str, role: str) -> str:
    res = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": PASSWORD, "role": role},
    )
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


def _force_demo_zoom(monkeypatch) -> None:
    def create_meeting(*, topic: str, duration_min: int = 90):
        return {
            "id": 90012345678,
            "password": "uda1234",
            "join_url": "https://zoom.us/j/90012345678?pwd=mock",
            "start_url": "https://zoom.us/s/90012345678?zak=mock",
            "zak": "mock-zak-90012345678",
            "mock": True,
            "topic": topic,
        }

    monkeypatch.setattr("app.api.v1.endpoints.Consultation.create_meeting", create_meeting)
    monkeypatch.setattr("app.api.v1.endpoints.Consultation.fetch_host_zak", lambda: None)


def test_consultation_zoom_mock_lifecycle(monkeypatch):
    _force_demo_zoom(monkeypatch)
    store.reset()
    clinician = _token("maya.harris", "physician")
    chair = _token("thomas.nguyen", "hod")
    member = _token("lena.morgan", "radiologist")

    denied = client.post(
        "/api/v1/consultation",
        headers={"Authorization": f"Bearer {chair}"},
        json={
            "study_id": "AIS-240913-058",
            "trigger_reason": "HoD must not create the room",
        },
    )
    assert denied.status_code == 403

    created = client.post(
        "/api/v1/consultation",
        headers={"Authorization": f"Bearer {clinician}"},
        json={
            "study_id": "AIS-240913-058",
            "trigger_reason": "Pytest clinical mismatch",
        },
    )
    assert created.status_code == 200, created.text
    session = created.json()
    assert session["status"] == "PENDING_ASSIGNMENT"
    assert session["lifecycle_phase"] == "initialization"
    assert session["zoom_mock"] is True
    assert session["zoom_meeting_number"]
    assert session["lead_chair_id"] in ("", None)
    assert "zoom_password" not in session
    assert "zoom_zak" not in session
    assert session["members"][0]["role_in_session"] == "Requester"
    assert session["members"][0]["employee_id"] == "PHY-024"

    too_early = client.post(
        f"/api/v1/consultation/{session['id']}/start",
        headers={"Authorization": f"Bearer {chair}"},
    )
    assert too_early.status_code == 409

    forbidden = client.post(
        f"/api/v1/consultation/{session['id']}/assign",
        headers={"Authorization": f"Bearer {member}"},
        json={"chairman_user_id": "u-hod-003", "participant_user_ids": ["u-rad-011"]},
    )
    assert forbidden.status_code == 403

    assigned = client.post(
        f"/api/v1/consultation/{session['id']}/assign",
        headers={"Authorization": f"Bearer {chair}"},
        json={"chairman_user_id": "u-hod-003", "participant_user_ids": ["u-rad-011"]},
    )
    assert assigned.status_code == 200, assigned.text
    panel = assigned.json()
    assert panel["status"] == "ASSIGNED"
    assert panel["lead_chair_id"] == "u-hod-003"
    roles = {item["user_id"]: item["role_in_session"] for item in panel["members"]}
    assert roles["u-hod-003"] == "Chair"
    assert roles["u-rad-011"] == "Member"
    assert roles["u-phy-024"] == "Member"

    notices = client.get(
        "/api/v1/notifications",
        headers={"Authorization": f"Bearer {member}"},
    )
    assert notices.status_code == 200
    assert any(session["id"] in item.get("body", "") for item in notices.json())

    started = client.post(
        f"/api/v1/consultation/{session['id']}/start",
        headers={"Authorization": f"Bearer {chair}"},
    )
    assert started.status_code == 200, started.text
    body = started.json()
    assert body["session"]["status"] == "LIVE"
    assert body["zoom"]["signature"]
    assert body["zoom"]["role"] == 1
    assert body["zoom"]["mock"] is True
    assert str(body["zoom"]["zak"]).startswith("mock-zak-")
    assert body["zoom"]["staff_id"] == "HOD-003"
    assert "HOD-003" in body["zoom"]["user_name"]

    joined = client.post(
        f"/api/v1/consultation/{session['id']}/join",
        headers={"Authorization": f"Bearer {member}"},
    )
    assert joined.status_code == 200, joined.text
    participant = joined.json()["zoom"]
    assert participant["role"] == 0
    assert participant["zak"] is None
    assert participant["staff_id"] == "RAD-011"
    assert "RAD-011" in participant["user_name"]
    assert any(
        row["employee_id"] == "RAD-011" and row["zoom_role"] == "participant"
        for row in joined.json()["session"]["attendance"]
    )

    vote = client.post(
        f"/api/v1/consultation/{session['id']}/agreement",
        headers={"Authorization": f"Bearer {member}"},
        json={"agreement": "Agree", "note": ""},
    )
    assert vote.status_code == 200, vote.text

    ended = client.post(
        "/api/v1/consultation/zoom/webhook",
        json={
            "event": "meeting.ended",
            "payload": {"object": {"id": session["zoom_meeting_number"]}},
        },
    )
    assert ended.status_code == 200, ended.text
    assert ended.json()["consultation"]["status"] == "AWAITING_CONCLUSION"

    finalized = client.post(
        f"/api/v1/consultation/{session['id']}/conclusion",
        headers={"Authorization": f"Bearer {chair}"},
        json={
            "conclusion": "Pytest consensus notes",
            "agreement": "Agree",
            "step_up_password": PASSWORD,
        },
    )
    assert finalized.status_code == 200, finalized.text
    done = finalized.json()
    assert done["status"] == "COMPLETED"
    assert done["conclusion"] == "Pytest consensus notes"
    assert str(done["digital_signature"]).startswith("sig-v1:")
    assert done["emr_entry"]["employee_id"] == "HOD-003"
    assert done["emr_entry"]["study_id"] == "AIS-240913-058"
    assert str(session["zoom_meeting_number"]).startswith("900")


def test_radiologist_requests_and_physician_opens_critical_only(monkeypatch):
    _force_demo_zoom(monkeypatch)
    store.reset()
    radiologist = _token("lena.morgan", "radiologist")
    physician = _token("maya.harris", "physician")
    hod = _token("thomas.nguyen", "hod")

    requested = client.post(
        "/api/v1/consultation",
        headers={"Authorization": f"Bearer {radiologist}"},
        json={
            "study_id": "AIS-240913-077",
            "trigger_reason": "Radiologist requests a panel",
        },
    )
    assert requested.status_code == 200, requested.text
    room = requested.json()
    assert room["requested_by_id"] == "u-rad-011"
    assert room["members"][0]["role_in_session"] == "Requester"
    assert room["members"][0]["employee_id"] == "RAD-011"
    assert room["zoom_mock"] is True
    assert str(room["zoom_meeting_number"]).startswith("900")

    routine = client.post(
        "/api/v1/consultation",
        headers={"Authorization": f"Bearer {physician}"},
        json={
            "study_id": "AIS-240913-077",
            "trigger_reason": "Physician must not open a non-critical room",
        },
    )
    assert routine.status_code == 403

    stolen = client.post(
        f"/api/v1/consultation/{room['id']}/assign",
        headers={"Authorization": f"Bearer {physician}"},
        json={"chairman_user_id": "u-phy-024", "participant_user_ids": ["u-rad-011"]},
    )
    assert stolen.status_code == 403

    emergency = client.post(
        "/api/v1/consultation",
        headers={"Authorization": f"Bearer {physician}"},
        json={
            "study_id": "AIS-240913-084",
            "trigger_reason": "Critical. Emergency room opened by the Chairman",
        },
    )
    assert emergency.status_code == 200, emergency.text
    opened = emergency.json()
    assigned = client.post(
        f"/api/v1/consultation/{opened['id']}/assign",
        headers={"Authorization": f"Bearer {physician}"},
        json={
            "chairman_user_id": "u-phy-024",
            "participant_user_ids": ["u-rad-011", "u-hod-003"],
        },
    )
    assert assigned.status_code == 200, assigned.text
    panel = assigned.json()
    assert panel["status"] == "ASSIGNED"
    assert panel["lead_chair_id"] == "u-phy-024"
    roles = {item["user_id"]: item["role_in_session"] for item in panel["members"]}
    assert roles["u-phy-024"] == "Chair"
    assert roles["u-rad-011"] == "Member"
    assert roles["u-hod-003"] == "Member"

    still_hod = client.post(
        f"/api/v1/consultation/{room['id']}/assign",
        headers={"Authorization": f"Bearer {hod}"},
        json={"chairman_user_id": "u-hod-003", "participant_user_ids": ["u-rad-011"]},
    )
    assert still_hod.status_code == 200, still_hod.text


def test_assign_resolves_production_uuid_outside_demo_state(monkeypatch):
    """HoD picks a PostgreSQL UUID from /users; that id is not in the seeded state."""
    from app.api.deps import CurrentUser, get_current_user
    from app.api.v1.endpoints import consultations as api

    chairman_id = "00000000-0000-0000-0000-000000000024"
    requester_id = "00000000-0000-0000-0000-000000000011"
    unknown_id = "00000000-0000-0000-0000-000000000099"
    hrm_users = {
        chairman_id: {
            "id": chairman_id,
            "username": "maya.harris",
            "display_name": "Dr. Maya Harris",
            "employee_id": "PHY-024",
            "role": "physician",
            "initials": "MH",
        },
        requester_id: {
            "id": requester_id,
            "username": "lena.morgan",
            "display_name": "Dr. Lena Morgan",
            "employee_id": "RAD-011",
            "role": "radiologist",
            "initials": "LM",
        },
    }
    state = {
        "users": [
            {
                "id": "u-rad-011",
                "username": "lena.morgan",
                "display_name": "Dr. Lena Morgan",
                "employee_id": "RAD-011",
                "role": "radiologist",
                "initials": "LA",
            }
        ],
        "Consultation": [
            {
                "id": "CON-UUID-001",
                "study_id": "AIS-1",
                "status": "PENDING_ASSIGNMENT",
                "requested_by_id": requester_id,
                "members": [],
                "trigger_reason": "UUID assignment",
                "lifecycle_phase": "initialization",
                "zoom_mock": True,
            }
        ],
        "notifications": [],
    }
    hod = CurrentUser(
        {
            "id": "00000000-0000-0000-0000-000000000003",
            "username": "thomas.nguyen",
            "display_name": "Dr. Thomas Nguyen",
            "employee_id": "HOD-003",
            "role": "hod",
            "initials": "TN",
        }
    )

    monkeypatch.setattr(api.settings, "demo_mode", False)
    monkeypatch.setattr(api.store, "mutate", lambda fn: fn(state))
    monkeypatch.setattr(api.store, "audit", lambda *args, **kwargs: None)

    async def _broadcast(*args, **kwargs):
        return None

    monkeypatch.setattr(api.consultation_hub, "broadcast", _broadcast)
    monkeypatch.setattr("app.services.user_service.get_user", lambda user_id: hrm_users.get(user_id))
    app.dependency_overrides[get_current_user] = lambda: hod
    try:
        missing = client.post(
            "/api/v1/consultation/CON-UUID-001/assign",
            headers={"Authorization": "Bearer test"},
            json={"chairman_user_id": unknown_id, "participant_user_ids": []},
        )
        assert missing.status_code == 400, missing.text
        assert missing.json()["detail"] == "Chairman must be a clinician"

        assigned = client.post(
            "/api/v1/consultation/CON-UUID-001/assign",
            headers={"Authorization": "Bearer test"},
            json={"chairman_user_id": chairman_id, "participant_user_ids": []},
        )
    finally:
        app.dependency_overrides.clear()

    assert assigned.status_code == 200, assigned.text
    panel = assigned.json()
    assert panel["lead_chair_id"] == chairman_id
    roles = {item["user_id"]: item["role_in_session"] for item in panel["members"]}
    assert roles[chairman_id] == "Chair"
    assert roles[requester_id] == "Member"
    assert panel["members"][0]["employee_id"] == "PHY-024"

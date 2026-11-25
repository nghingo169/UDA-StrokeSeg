"""Small SQL helpers for domain services during the demo-store migration."""

from __future__ import annotations

import json
from typing import Any

from sqlalchemy import text

from app.db.session import SessionLocal


def list_users() -> list[dict[str, Any]]:
    with SessionLocal() as db:
        rows = db.execute(text("""
            SELECT u.user_id, u.username, u.email, u.full_name, u.department,
                   u.employee_id, u.is_active, r.role_name
            FROM app_user u
            LEFT JOIN user_role ur ON ur.user_id = u.user_id
            LEFT JOIN role r ON r.role_id = ur.role_id
            WHERE u.is_active = true
            ORDER BY u.full_name
        """)).mappings().all()
    users: dict[str, dict[str, Any]] = {}
    for row in rows:
        item = users.setdefault(str(row["user_id"]), {
            "id": str(row["user_id"]), "username": row["username"],
            "email": row["email"], "display_name": row["full_name"],
            "department": row["department"], "employee_id": row["employee_id"],
            "is_active": row["is_active"], "role": row["role_name"],
        })
        if not item.get("role"):
            item["role"] = row["role_name"]
    return list(users.values())


def find_user(username: str, role: str | None = None) -> dict[str, Any] | None:
    with SessionLocal() as db:
        row = db.execute(text("""
            SELECT u.user_id, u.username, u.email, u.full_name, u.department,
                   u.employee_id, u.is_active, r.role_name
            FROM app_user u
            JOIN user_role ur ON ur.user_id = u.user_id
            JOIN role r ON r.role_id = ur.role_id
            WHERE u.username = :username AND u.is_active = true
              AND (:role IS NULL OR r.role_name = :role)
            ORDER BY r.access_level DESC LIMIT 1
        """), {"username": username, "role": role}).mappings().first()
    if not row:
        return None
    return {"id": str(row["user_id"]), "username": row["username"],
            "email": row["email"], "display_name": row["full_name"],
            "department": row["department"], "employee_id": row["employee_id"],
            "is_active": row["is_active"], "role": row["role_name"]}


def write_audit(action: str, actor: str, resource: str, result: str = "OK") -> None:
    with SessionLocal.begin() as db:
        user_id = db.execute(text("SELECT user_id FROM app_user WHERE username = :username"), {"username": actor}).scalar_one_or_none()
        db.execute(text("""
            INSERT INTO audit_log(user_id, action, entity_type, payload_snapshot)
            VALUES (:user_id, :action, :entity_type, CAST(:payload AS jsonb))
        """), {"user_id": user_id, "action": action, "entity_type": resource,
               "payload": json.dumps({"result": result})})


def list_audit(limit: int = 50) -> list[dict[str, Any]]:
    with SessionLocal() as db:
        rows = db.execute(text("""
            SELECT a.created_at, a.action, a.entity_type, a.payload_snapshot,
                   u.username
            FROM audit_log a LEFT JOIN app_user u ON u.user_id = a.user_id
            ORDER BY a.created_at DESC LIMIT :limit
        """), {"limit": limit}).mappings().all()
    return [{"ts": row["created_at"].isoformat(), "event": row["action"],
             "actor": row["username"] or "system", "resource": row["entity_type"],
             "result": (row["payload_snapshot"] or {}).get("result", "OK")}
            for row in rows]


def _study(row: Any) -> dict[str, Any]:
    data = dict(row._mapping)
    clinical = data.pop("clinical_data", {}) or {}
    return {
        **clinical,
        "id": data.pop("external_id"),
        "status": data.pop("status"),
        "patient": clinical.get("patient", data.pop("patient_ref", "")),
        "volume": clinical.get("volume", 0),
        "mask_version": clinical.get("mask_version", "System draft 01"),
        "case_state": clinical.get("case_state", "InProgress"),
        "_db_id": str(data.pop("study_id")),
    }


def list_studies(priority: str | None = None, query: str | None = None) -> list[dict[str, Any]]:
    sql = """SELECT s.study_id, s.external_id, s.status, s.clinical_data,
             p.external_patient_ref AS patient_ref
             FROM study s JOIN patient p ON p.patient_id = s.patient_id
             WHERE (:priority IS NULL OR :priority = 'All' OR s.status = :priority)
             AND (:query IS NULL OR lower(s.external_id) LIKE lower(:like_query)
                  OR lower(p.external_patient_ref) LIKE lower(:like_query))
             ORDER BY s.created_at DESC"""
    with SessionLocal() as db:
        rows = db.execute(text(sql), {"priority": priority, "query": query, "like_query": f"%{query}%" if query else None}).all()
    return [_study(row) for row in rows]


def get_study(study_id: str) -> dict[str, Any] | None:
    with SessionLocal() as db:
        row = db.execute(text("""SELECT s.study_id, s.external_id, s.status, s.clinical_data,
            p.external_patient_ref AS patient_ref FROM study s JOIN patient p ON p.patient_id = s.patient_id
            WHERE s.external_id = :study_id"""), {"study_id": study_id}).first()
    return _study(row) if row else None


def create_study(accession: str, series: list[str], actor: str) -> dict[str, Any]:
    """Create the minimum normalized Study aggregate produced by PACS intake."""
    with SessionLocal.begin() as db:
        patient_ref = f"PATIENT:{accession}"
        patient = db.execute(text("""INSERT INTO patient(external_patient_ref) VALUES (:ref)
            ON CONFLICT (external_patient_ref) DO UPDATE SET external_patient_ref = EXCLUDED.external_patient_ref
            RETURNING patient_id"""), {"ref": patient_ref}).scalar_one()
        study_id = db.execute(text("""INSERT INTO study(external_id, patient_id, accession_number, status, clinical_data)
            VALUES (:external_id, :patient_id, :accession, 'Validated', CAST(:clinical AS jsonb))
            ON CONFLICT (external_id) DO UPDATE SET status = 'Validated', clinical_data = EXCLUDED.clinical_data
            RETURNING study_id"""), {"external_id": accession, "patient_id": patient, "accession": accession, "clinical": json.dumps({"patient": patient_ref, "series": series, "received": "now", "case_state": "InProgress", "mask_version": "System draft 01", "volume": 0, "created_by": actor})}).scalar_one()
        for modality in series:
            db.execute(text("""INSERT INTO series(study_id, modality) VALUES (:study_id, :modality)
                ON CONFLICT DO NOTHING"""), {"study_id": study_id, "modality": modality})
    return get_study(accession) or {"id": accession, "status": "Validated", "series": series}


def update_study(study_id: str, *, status: str | None = None, clinical: dict[str, Any] | None = None) -> dict[str, Any] | None:
    with SessionLocal.begin() as db:
        row = db.execute(text("SELECT study_id, clinical_data FROM study WHERE external_id = :study_id FOR UPDATE"), {"study_id": study_id}).first()
        if not row:
            return None
        current = dict(row.clinical_data or {})
        current.update(clinical or {})
        db.execute(text("UPDATE study SET status = COALESCE(:status, status), clinical_data = CAST(:clinical AS jsonb), updated_at = now() WHERE external_id = :study_id"), {"status": status, "clinical": json.dumps(current), "study_id": study_id})
    return get_study(study_id)


def save_report(study_id: str, *, status: str, content: dict[str, Any], signer: str | None = None) -> None:
    with SessionLocal.begin() as db:
        row = db.execute(text("SELECT study_id FROM study WHERE external_id = :study_id"), {"study_id": study_id}).first()
        if not row:
            return
        db.execute(text("""INSERT INTO report(study_id, report_version, status, content, generated_at)
            VALUES (:study_id, 1, :status, CAST(:content AS jsonb), now())
            ON CONFLICT (study_id, report_version) DO UPDATE SET status = EXCLUDED.status,
            content = EXCLUDED.content, generated_at = now(), signed_at = CASE WHEN :status = 'SIGNED' THEN now() ELSE report.signed_at END"""), {"study_id": row.study_id, "status": status, "content": json.dumps({**content, "signer": signer})})


def get_report(study_id: str, status: str | None = None) -> dict[str, Any] | None:
    with SessionLocal() as db:
        row = db.execute(text("""SELECT r.content, r.status, r.report_version FROM report r JOIN study s ON s.study_id = r.study_id
            WHERE s.external_id = :study_id AND (:status IS NULL OR r.status = :status)
            ORDER BY r.report_version DESC LIMIT 1"""), {"study_id": study_id, "status": status}).first()
    if not row:
        return None
    return {**(row.content or {}), "status": row.status, "report_version": row.report_version}


def sync_consultations(db: Any, sessions: list[dict[str, Any]]) -> None:
    """Persist the current consultation aggregate into normalized tables."""
    for session in sessions:
        study = db.execute(text("SELECT study_id FROM study WHERE external_id = :id"), {"id": session.get("study_id")}).scalar_one_or_none()
        if not study:
            continue
        session_row = db.execute(text("""INSERT INTO consultation_session
            (external_id, study_id, status, provider_meeting_id, provider_metadata, consensus_notes, digital_signature, started_at, ended_at)
            VALUES (:external_id, :study_id, :status, :meeting_id, CAST(:metadata AS jsonb), :notes, :signature, :started_at, :ended_at)
            ON CONFLICT (external_id) DO UPDATE SET status = EXCLUDED.status, provider_meeting_id = EXCLUDED.provider_meeting_id,
              provider_metadata = EXCLUDED.provider_metadata, consensus_notes = EXCLUDED.consensus_notes,
              digital_signature = EXCLUDED.digital_signature, started_at = EXCLUDED.started_at, ended_at = EXCLUDED.ended_at
            RETURNING consultation_id"""), {"external_id": session.get("id"), "study_id": study, "status": session.get("status", "PENDING_ASSIGNMENT"), "meeting_id": session.get("zoom_meeting_number"), "metadata": json.dumps({k: session.get(k) for k in ("trigger_reason", "zoom_join_url", "assigned_by", "assigned_at", "attendance", "discussion", "viewport")}), "notes": session.get("consensus_notes"), "signature": session.get("digital_signature"), "started_at": session.get("started_at"), "ended_at": session.get("ended_at")}).scalar_one()
        db.execute(text("DELETE FROM consultation_member WHERE consultation_id = :id"), {"id": session_row})
        for member in session.get("members", []):
            db.execute(text("""INSERT INTO consultation_member(consultation_id, external_user_id, member_metadata)
                VALUES (:consultation_id, :external_user_id, CAST(:metadata AS jsonb))"""), {"consultation_id": session_row, "external_user_id": str(member.get("user_id") or member.get("username")), "metadata": json.dumps(member)})

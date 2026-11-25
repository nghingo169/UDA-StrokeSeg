from fastapi import HTTPException

from app.demo_store import store
from app.core.config import settings
from app.db import domain


def draft_report(study_id: str) -> dict:
    if not settings.demo_mode:
        study = domain.get_study(study_id)
        if not study:
            raise HTTPException(status_code=404, detail="Study not found")
        note = study.get("clinical_note_draft", {}).get("note", "") if isinstance(study.get("clinical_note_draft"), dict) else ""
        return {"study_id": study_id, "watermark": "DRAFT", "note": note, "volume_ml": study.get("volume"), "mask_version": study.get("mask_version", "System draft 01"), "download_url": f"/api/v1/Report/{study_id}/pdf?draft=1"}
    snap = store.snapshot()
    study = next((s for s in snap["studies"] + snap["signed_studies"] if s["id"] == study_id), None)
    if not study:
        raise HTTPException(status_code=404, detail="Study not found")
    note = snap["notes"].get(study_id, {}).get("note") or study.get("clinical_note") or ""
    return {
        "study_id": study_id,
        "watermark": "DRAFT" if study.get("case_state") != "SignedOff" else None,
        "note": note,
        "volume_ml": study.get("volume"),
        "mask_version": study.get("mask_version", "System draft 01"),
        "download_url": f"/api/v1/Report/{study_id}/pdf?draft=1",
    }


def signed_pdf_meta(study_id: str) -> dict:
    if not settings.demo_mode:
        report = domain.get_report(study_id, "SIGNED")
        if not report:
            raise HTTPException(status_code=404, detail="Signed report not found")
        return {"study_id": study_id, "signer": report.get("signer", ""), "signed": report.get("signed", ""), "report_version": f"RPT-{report.get('report_version', 1):02d}", "download_url": f"/api/v1/Report/{study_id}/pdf"}
    study = next((s for s in store.snapshot()["signed_studies"] if s["id"] == study_id), None)
    if not study:
        raise HTTPException(status_code=404, detail="Signed report not found")
    return {
        "study_id": study_id,
        "signer": study["signer"],
        "signed": study["signed"],
        "report_version": study.get("report_version", "RPT-01"),
        "download_url": f"/api/v1/Report/{study_id}/pdf",
    }

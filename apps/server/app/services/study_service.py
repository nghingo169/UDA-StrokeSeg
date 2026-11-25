from fastapi import HTTPException, status

from app.demo_store import store
from app.core.config import settings
from app.db import domain


def list_studies(priority: str | None = None, query: str | None = None) -> list[dict]:
    if not settings.demo_mode:
        return domain.list_studies(priority, query)
    studies = store.snapshot()["studies"]
    if priority and priority != "All":
        studies = [s for s in studies if s["status"] == priority]
    if query:
        q = query.lower()
        studies = [s for s in studies if q in s["id"].lower() or q in s["patient"].lower()]
    return studies


def list_signed() -> list[dict]:
    if not settings.demo_mode:
        return [s for s in domain.list_studies("SignedOff")]
    return store.snapshot()["signed_studies"]


def get_study(study_id: str) -> dict:
    if not settings.demo_mode:
        study = domain.get_study(study_id)
        if not study:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Study not found")
        return {**study, "clinical_note_draft": study.get("clinical_note_draft"), "disposition_record": study.get("disposition_record"), "series": ["DWI", "ADC", "FLAIR"]}
    snap = store.snapshot()
    for study in snap["studies"] + snap["signed_studies"]:
        if study["id"] == study_id:
            note = snap["notes"].get(study_id)
            disposition = snap["disposition_notes"].get(study_id)
            return {
                **study,
                "clinical_note_draft": note,
                "disposition_record": disposition,
                "series": ["DWI", "ADC", "FLAIR"],
            }
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Study not found")


def save_note(study_id: str, note: str, source: str, actor: str) -> dict:
    if not settings.demo_mode:
        if not domain.get_study(study_id):
            raise HTTPException(status_code=404, detail="Study not found")
        saved = {"note": note, "source": source, "updated_by": actor}
        domain.update_study(study_id, clinical={"clinical_note_draft": saved})
        store.audit("NOTE_SAVE", actor, study_id)
        return saved
    get_study(study_id)

    def write(state):
        state["notes"][study_id] = {"note": note, "source": source, "updated_by": actor}
        return state["notes"][study_id]

    saved = store.mutate(write)
    store.audit("NOTE_SAVE", actor, study_id)
    return saved


def save_disposition(study_id: str, disposition: str, note: str, actor: str) -> dict:
    get_study(study_id)
    if disposition == "not_used" and not note.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Disposition note required when suggestion is not used",
        )
    if not settings.demo_mode:
        if not domain.get_study(study_id):
            raise HTTPException(status_code=404, detail="Study not found")
        saved = {"disposition": disposition, "note": note, "updated_by": actor}
        domain.update_study(study_id, clinical={"disposition_record": saved})
        store.audit("DISPOSITION", actor, study_id)
        return saved

    def write(state):
        state["disposition_notes"][study_id] = {
            "disposition": disposition,
            "note": note,
            "updated_by": actor,
        }
        return state["disposition_notes"][study_id]

    saved = store.mutate(write)
    store.audit("DISPOSITION", actor, study_id)
    return saved

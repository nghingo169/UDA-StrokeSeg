from fastapi import APIRouter, Query
from fastapi.responses import PlainTextResponse

from app.services import report_service

router = APIRouter(prefix="/Report", tags=["Report"])


@router.get("/{study_id}/draft")
def draft(study_id: str):
    return report_service.draft_report(study_id)


@router.get("/{study_id}")
def signed(study_id: str):
    return report_service.signed_pdf_meta(study_id)


@router.get("/{study_id}/pdf")
def pdf(study_id: str, draft: bool = Query(default=False)):
    meta = report_service.draft_report(study_id) if draft else report_service.signed_pdf_meta(study_id)
    content = (
        f"UDA-StrokeSeg {'DRAFT' if draft else 'SIGNED'} REPORT\n"
        f"Study: {study_id}\n"
        f"Meta: {meta}\n"
        "Demo PDF placeholder for lecturer walkthrough.\n"
    )
    return PlainTextResponse(content, media_type="text/plain")

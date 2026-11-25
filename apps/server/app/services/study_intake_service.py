from app.demo_store import store
from app.core.config import settings
from app.db import domain
from app.services.event_publisher import publish


def intake_study(accession: str, series: list[str], actor: str) -> dict:
    required = {"DWI", "ADC", "FLAIR"}
    missing = sorted(required - set(series))
    if missing:
        item = {
            "id": f"INC-DEMO-{len(store.snapshot()['quarantine']) + 1:03d}",
            "reason": f"Missing mandatory sequence: {', '.join(missing)}",
            "ae_title": "DEMO_PACS",
            "received": "now",
            "dicom_status": "0xC000",
        }

        def write(state):
            state["quarantine"].insert(0, item)
            return item

        quarantined = store.mutate(write)
        store.audit("QUARANTINE", actor, accession, "FAILED")
        return {"status": "quarantined", "item": quarantined}

    publish("StudyValidated", {"accession": accession, "series": series})
    if not settings.demo_mode:
        domain.create_study(accession, series, actor)
    store.audit("INTAKE_OK", actor, accession)
    return {"status": "validated", "accession": accession, "series": series}

from app.demo_store import store


def log_state(study_id: str, state: str, actor: str) -> None:
    store.audit(f"CASE_STATE:{state}", actor, study_id)

"""Shared clinical / ops constants."""

SLA_SECONDS = 180
DEMO_PASSWORD = "Pass@123"

CASE_PRIORITIES = ("Critical", "Priority", "Routine")
PROGRESS_STATES = ("waiting", "in_progress", "overdue")
DISPOSITIONS = (
    "accepted_unchanged",
    "accepted_with_adjustment",
    "not_used",
)
ROLES = ("radiologist", "physician", "hod", "it")

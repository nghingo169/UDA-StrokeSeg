"""v1 endpoint modules.

The endpoint modules use lowercase filenames.  Keep the historical exported
names as aliases because a few integration tests and external callers still
refer to ``Consultation`` and ``Report``.
"""

from . import consultations, reports

Consultation = consultations
Report = reports

__all__ = ["Consultation", "Report", "consultations", "reports"]

"""DB session stub - demo mode uses in-memory store (no PostgreSQL required)."""

DEMO_MODE = True


def get_db():
    yield None

"""SQLAlchemy Base stub - ORM models remain placeholders in demo mode."""

try:
    from sqlalchemy.orm import DeclarativeBase

    class Base(DeclarativeBase):
        pass
except ImportError:  # pragma: no cover - SQLAlchemy optional for demo

    class Base:  # type: ignore[no-redef]
        pass

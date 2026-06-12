"""
Database engine configuration and session provider.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from src.core.config import get_settings

settings = get_settings()

# Determine database url dynamically from parameters if available
db_url = settings.DATABASE_URL

connect_args = {}

if db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    engine = create_engine(db_url, connect_args=connect_args)
else:
    # Production PostgreSQL connection pooling configurations
    engine = create_engine(
        db_url,
        pool_pre_ping=True,
        pool_size=20,
        max_overflow=10,
        pool_timeout=30,
        pool_recycle=1800,
    )
    # Verify connection to fail-fast
    try:
        with engine.connect() as conn:
            pass
    except Exception as e:
        import sys

        print(
            f"CRITICAL: Failed to connect to PostgreSQL database: {e}", file=sys.stderr
        )
        raise e

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Base model class for SQLAlchemy declarative mapping."""

    pass


def get_db():
    """Dependency injection helper supplying scoped sessions."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

"""Pytest session bootstrap.

This module is imported by pytest before any test module (and therefore before
``src.main``/``src.core.config`` are imported). We establish a safe, deterministic
environment here so that:

* ``DEBUG`` is enabled, which disables the production strong-secret startup guard
  in :func:`src.main.create_app` (importing the FastAPI app would otherwise raise).
* A strong throwaway ``SECRET_KEY`` is present (defence in depth if DEBUG is off).
* Sensible local defaults exist for the database/redis URLs.

``setdefault`` is used so CI-provided values (e.g. a real Postgres URL in the
integration workflow) are never overwritten.
"""

import os

os.environ.setdefault("DEBUG", "true")
os.environ.setdefault(
    "SECRET_KEY", "test-secret-key-not-for-production-use-0123456789abcdef"
)
os.environ.setdefault("DATABASE_URL", "sqlite:///test.db")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")

#!/bin/sh
# DataForge AI backend container entrypoint.
#
# Database schema is owned by Alembic migrations (not SQLAlchemy create_all).
# Only the service that sets RUN_MIGRATIONS=true (the API) applies migrations,
# so Celery workers/beat that share this image never race on schema changes.
set -eu

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
    echo "[entrypoint] Applying database migrations (alembic upgrade head)..."
    attempt=1
    max_attempts=10
    until alembic upgrade head; do
        if [ "$attempt" -ge "$max_attempts" ]; then
            echo "[entrypoint] Migrations failed after ${max_attempts} attempts; aborting." >&2
            exit 1
        fi
        echo "[entrypoint] Migration attempt ${attempt} failed; retrying in 3s..."
        attempt=$((attempt + 1))
        sleep 3
    done
    echo "[entrypoint] Migrations applied successfully."
fi

exec "$@"

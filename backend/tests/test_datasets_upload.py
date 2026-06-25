"""Integration tests for dataset source-file uploads.

Runs against the FastAPI app with the object store overridden by the in-memory
backend, so no MinIO/S3 instance is required.
"""

import random

import pytest
from fastapi.testclient import TestClient

from src.core.database import Base, engine
from src.datasets.router import get_storage
from src.main import app
from src.storage import InMemoryObjectStore

Base.metadata.create_all(bind=engine)

# Shared in-memory store so uploaded bytes can be asserted on after the request.
_TEST_STORE = InMemoryObjectStore()
app.dependency_overrides[get_storage] = lambda: _TEST_STORE

client = TestClient(app)


def _make_user() -> dict:
    suffix = random.randint(10000, 99999)
    resp = client.post(
        "/api/auth/signup",
        json={
            "name": "Upload Tester",
            "email": f"upload_{suffix}@dataforge.ai",
            "password": "SecurePassword123!",
        },
    )
    assert resp.status_code == 201
    return {"Authorization": f"Bearer {resp.json()['token']}"}


def _create_dataset(headers: dict, source_type: str) -> str:
    suffix = random.randint(10000, 99999)
    resp = client.post(
        "/api/projects/",
        json={"name": f"DS {suffix}", "sourceType": source_type, "config": {}},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def test_csv_upload_succeeds_and_is_stored():
    headers = _make_user()
    dataset_id = _create_dataset(headers, "csv")
    payload = b"col1,col2\n1,2\n3,4\n"

    resp = client.post(
        f"/api/datasets/{dataset_id}/files",
        files={"file": ("data.csv", payload, "text/csv")},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["originalFilename"] == "data.csv"
    assert body["sizeBytes"] == len(payload)
    assert body["status"] == "stored"

    # Listing returns the uploaded file.
    listing = client.get(f"/api/datasets/{dataset_id}/files", headers=headers)
    assert listing.status_code == 200
    assert any(f["id"] == body["id"] for f in listing.json())

    # The bytes actually landed in object storage.
    stored_keys = list(_TEST_STORE._objects.keys())
    assert len(stored_keys) >= 1
    assert any(_TEST_STORE.get_object(k) == payload for k in stored_keys)


def test_upload_rejects_content_type_mismatch():
    headers = _make_user()
    dataset_id = _create_dataset(headers, "pdf")
    # .pdf extension but the bytes are not a PDF -> magic check fails.
    resp = client.post(
        f"/api/datasets/{dataset_id}/files",
        files={"file": ("fake.pdf", b"this is not a pdf", "application/pdf")},
        headers=headers,
    )
    assert resp.status_code == 400


def test_upload_rejects_wrong_extension():
    headers = _make_user()
    dataset_id = _create_dataset(headers, "csv")
    resp = client.post(
        f"/api/datasets/{dataset_id}/files",
        files={"file": ("data.exe", b"MZ\x90\x00", "application/octet-stream")},
        headers=headers,
    )
    assert resp.status_code == 400


def test_upload_to_url_dataset_is_rejected():
    headers = _make_user()
    dataset_id = _create_dataset(headers, "url")
    resp = client.post(
        f"/api/datasets/{dataset_id}/files",
        files={"file": ("data.csv", b"a,b\n1,2\n", "text/csv")},
        headers=headers,
    )
    assert resp.status_code == 400


def test_upload_cross_workspace_is_forbidden():
    owner = _make_user()
    dataset_id = _create_dataset(owner, "csv")

    attacker = _make_user()
    resp = client.post(
        f"/api/datasets/{dataset_id}/files",
        files={"file": ("data.csv", b"a,b\n1,2\n", "text/csv")},
        headers=attacker,
    )
    # Attacker's workspace does not contain the dataset -> 404 (not found there).
    assert resp.status_code == 404

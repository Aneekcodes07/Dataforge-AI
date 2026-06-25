"""Datasets router — source file uploads and (later) records/download endpoints."""

from __future__ import annotations

import hashlib
import logging
import os
import tempfile
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from src.auth.models import User, WorkspaceMembership
from src.auth.router import get_current_user
from src.core.config import get_settings
from src.core.database import get_db
from src.datasets.models import Dataset, SourceFile
from src.datasets.schemas import SourceFileResponse
from src.ingestion.validation import (
    FILE_SOURCE_TYPES,
    UploadValidationError,
    validate_upload,
)
from src.storage import ObjectStore, get_object_store

logger = logging.getLogger(__name__)
router = APIRouter()

_READ_CHUNK = 1024 * 1024  # 1 MiB


def get_storage() -> ObjectStore:
    """FastAPI dependency returning the configured object store.

    Overridable in tests with an in-memory backend via dependency_overrides.
    """
    return get_object_store()


def _require_dataset(db: Session, user: User, dataset_id: str) -> Dataset:
    try:
        ds_uuid = uuid.UUID(dataset_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid dataset ID format"
        )

    membership = (
        db.query(WorkspaceMembership)
        .filter(WorkspaceMembership.user_id == user.id)
        .first()
    )
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User does not belong to any workspace",
        )

    dataset = (
        db.query(Dataset)
        .filter(
            Dataset.id == ds_uuid,
            Dataset.workspace_id == membership.workspace_id,
        )
        .first()
    )
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found"
        )
    return dataset


@router.post(
    "/{dataset_id}/files",
    response_model=SourceFileResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_source_file(
    dataset_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    store: ObjectStore = Depends(get_storage),
):
    """Upload a raw source file for a dataset.

    The file is validated (extension + magic bytes + size cap), streamed to object
    storage, and recorded in ``source_files``. The body is read in chunks so large
    files never need to fit in memory.
    """
    settings = get_settings()
    dataset = _require_dataset(db, current_user, dataset_id)

    source_type = (dataset.source_type or "").lower()
    if source_type not in FILE_SOURCE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Source type '{source_type}' does not accept file uploads",
        )

    hasher = hashlib.sha256()
    size = 0
    head = b""
    spool = tempfile.SpooledTemporaryFile(max_size=8 * 1024 * 1024)
    try:
        while True:
            chunk = await file.read(_READ_CHUNK)
            if not chunk:
                break
            if not head:
                head = chunk[:512]
            size += len(chunk)
            if size > settings.MAX_UPLOAD_BYTES:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=(
                        f"File exceeds the maximum allowed size of "
                        f"{settings.MAX_UPLOAD_BYTES} bytes"
                    ),
                )
            hasher.update(chunk)
            spool.write(chunk)

        if size == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty"
            )

        try:
            content_type = validate_upload(source_type, file.filename or "", head)
        except UploadValidationError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
            )

        ext = os.path.splitext(file.filename or "")[1].lower()
        file_uuid = uuid.uuid4()
        storage_key = (
            f"workspaces/{dataset.workspace_id}/datasets/{dataset.id}"
            f"/sources/{file_uuid}{ext}"
        )
        spool.seek(0)
        store.put_stream(storage_key, spool, content_type=content_type)
    finally:
        spool.close()

    source_file = SourceFile(
        workspace_id=dataset.workspace_id,
        dataset_id=dataset.id,
        original_filename=file.filename or f"upload{ext}",
        content_type=content_type,
        size_bytes=size,
        storage_key=storage_key,
        checksum_sha256=hasher.hexdigest(),
        status="stored",
    )
    db.add(source_file)
    db.commit()
    db.refresh(source_file)

    logger.info(
        "Stored source file %s (%d bytes) for dataset %s",
        source_file.id,
        size,
        dataset.id,
    )

    return SourceFileResponse(
        id=str(source_file.id),
        dataset_id=str(source_file.dataset_id),
        original_filename=source_file.original_filename,
        content_type=source_file.content_type,
        size_bytes=source_file.size_bytes,
        checksum_sha256=source_file.checksum_sha256,
        status=source_file.status,
        created_at=source_file.created_at,
    )


@router.get("/{dataset_id}/files", response_model=list[SourceFileResponse])
def list_source_files(
    dataset_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List the source files uploaded for a dataset."""
    dataset = _require_dataset(db, current_user, dataset_id)
    files = (
        db.query(SourceFile)
        .filter(SourceFile.dataset_id == dataset.id)
        .order_by(SourceFile.created_at.desc())
        .all()
    )
    return [
        SourceFileResponse(
            id=str(f.id),
            dataset_id=str(f.dataset_id),
            original_filename=f.original_filename,
            content_type=f.content_type,
            size_bytes=f.size_bytes,
            checksum_sha256=f.checksum_sha256,
            status=f.status,
            created_at=f.created_at,
        )
        for f in files
    ]

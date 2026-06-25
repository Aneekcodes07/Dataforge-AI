"""S3-compatible object store (AWS S3, MinIO, Cloudflare R2).

``boto3`` is imported lazily inside the constructor so that importing this module
(and the in-memory test double alongside it) does not require boto3 to be
installed, and so unit tests that never touch S3 stay dependency-free.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, BinaryIO, Iterator

from src.storage.base import (
    ObjectNotFoundError,
    ObjectStore,
    StorageError,
    StoredObject,
)

if TYPE_CHECKING:  # pragma: no cover - typing only
    from src.core.config import Settings

logger = logging.getLogger(__name__)


class S3ObjectStore(ObjectStore):
    """Object store backed by any S3-compatible service."""

    def __init__(self, settings: "Settings") -> None:
        try:
            import boto3
            from botocore.client import Config
            from botocore.exceptions import ClientError
        except ImportError as exc:  # pragma: no cover - environment guard
            raise StorageError(
                "boto3 is required for S3 object storage but is not installed"
            ) from exc

        self._ClientError = ClientError
        self._bucket = settings.STORAGE_BUCKET
        self._client = boto3.client(
            "s3",
            endpoint_url=settings.STORAGE_ENDPOINT_URL or None,
            region_name=settings.STORAGE_REGION,
            aws_access_key_id=settings.STORAGE_ACCESS_KEY or None,
            aws_secret_access_key=settings.STORAGE_SECRET_KEY or None,
            use_ssl=settings.STORAGE_USE_SSL,
            config=Config(
                signature_version="s3v4",
                s3={"addressing_style": "path"},
                retries={"max_attempts": 3, "mode": "standard"},
            ),
        )
        self.ensure_bucket()

    def ensure_bucket(self) -> None:
        """Create the configured bucket if it does not already exist.

        Tolerates the storage service still warming up at process start by
        retrying transient connection failures with a short backoff.
        """
        import time

        last_exc: Exception | None = None
        for attempt in range(10):
            try:
                self._client.head_bucket(Bucket=self._bucket)
                return
            except self._ClientError:
                try:
                    self._client.create_bucket(Bucket=self._bucket)
                    logger.info("Created object storage bucket '%s'", self._bucket)
                    return
                except self._ClientError as exc:
                    if _is_not_found(exc):
                        # Bucket genuinely absent and we failed to create it.
                        raise StorageError(
                            f"Unable to create bucket '{self._bucket}': {exc}"
                        ) from exc
                    last_exc = exc
            except Exception as exc:  # noqa: BLE001 - connection errors while warming up
                last_exc = exc
            time.sleep(min(1.0 * (attempt + 1), 5.0))
        raise StorageError(
            f"Object storage not reachable for bucket '{self._bucket}': {last_exc}"
        )

    def put_object(
        self, key: str, data: bytes, content_type: str | None = None
    ) -> StoredObject:
        extra = {"ContentType": content_type} if content_type else {}
        try:
            self._client.put_object(Bucket=self._bucket, Key=key, Body=data, **extra)
        except self._ClientError as exc:
            raise StorageError(f"Failed to put object '{key}': {exc}") from exc
        return StoredObject(key=key, size=len(data), content_type=content_type)

    def put_stream(
        self, key: str, stream: BinaryIO, content_type: str | None = None
    ) -> StoredObject:
        extra = {"ContentType": content_type} if content_type else {}
        try:
            self._client.upload_fileobj(
                stream, self._bucket, key, ExtraArgs=extra or None
            )
            head = self._client.head_object(Bucket=self._bucket, Key=key)
        except self._ClientError as exc:
            raise StorageError(f"Failed to stream object '{key}': {exc}") from exc
        return StoredObject(
            key=key,
            size=int(head.get("ContentLength", 0)),
            content_type=content_type,
        )

    def get_object(self, key: str) -> bytes:
        try:
            resp = self._client.get_object(Bucket=self._bucket, Key=key)
            return resp["Body"].read()
        except self._ClientError as exc:
            if _is_not_found(exc):
                raise ObjectNotFoundError(key) from exc
            raise StorageError(f"Failed to get object '{key}': {exc}") from exc

    def open_stream(self, key: str, chunk_size: int = 1024 * 1024) -> Iterator[bytes]:
        try:
            resp = self._client.get_object(Bucket=self._bucket, Key=key)
        except self._ClientError as exc:
            if _is_not_found(exc):
                raise ObjectNotFoundError(key) from exc
            raise StorageError(f"Failed to open object '{key}': {exc}") from exc
        body = resp["Body"]
        while True:
            chunk = body.read(chunk_size)
            if not chunk:
                break
            yield chunk

    def delete(self, key: str) -> None:
        try:
            self._client.delete_object(Bucket=self._bucket, Key=key)
        except self._ClientError as exc:  # pragma: no cover - delete is best effort
            raise StorageError(f"Failed to delete object '{key}': {exc}") from exc

    def exists(self, key: str) -> bool:
        try:
            self._client.head_object(Bucket=self._bucket, Key=key)
            return True
        except self._ClientError as exc:
            if _is_not_found(exc):
                return False
            raise StorageError(f"Failed to stat object '{key}': {exc}") from exc

    def presigned_get_url(self, key: str, expires_in: int = 3600) -> str:
        try:
            return self._client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self._bucket, "Key": key},
                ExpiresIn=expires_in,
            )
        except self._ClientError as exc:
            raise StorageError(f"Failed to presign URL for '{key}': {exc}") from exc


def _is_not_found(exc: Exception) -> bool:
    """Return True if a botocore ClientError represents a missing key/bucket."""
    response = getattr(exc, "response", {}) or {}
    code = str(response.get("Error", {}).get("Code", ""))
    status = response.get("ResponseMetadata", {}).get("HTTPStatusCode")
    return code in {"NoSuchKey", "NoSuchBucket", "404"} or status == 404

"""Dataset Pydantic schemas."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class SourceFileResponse(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    id: str
    dataset_id: str
    original_filename: str
    content_type: str | None = None
    size_bytes: int
    checksum_sha256: str | None = None
    status: str
    created_at: datetime

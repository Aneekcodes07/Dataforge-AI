"""
Pipelines Pydantic validation schemas.
"""

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel
from datetime import datetime
from typing import Optional


class PipelineResponse(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )
    id: str
    workspace_id: str
    dataset_id: Optional[str]
    name: str
    description: Optional[str] = None
    status: str
    cron_schedule: Optional[str] = None
    run_configuration: dict = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class PipelineRunResponse(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )
    id: str
    pipeline_id: str
    status: str
    triggered_by: Optional[str] = None
    duration_seconds: int
    records_processed: int
    error_message: Optional[str] = None
    logs_path: Optional[str] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None


class PipelineCreate(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )
    name: str
    dataset_id: str
    description: Optional[str] = None
    cron_schedule: Optional[str] = None
    run_configuration: dict = Field(default_factory=dict)

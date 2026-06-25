"""
Project Pydantic schemas.
"""

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel
from datetime import datetime


class ProjectResponse(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )
    id: str
    name: str
    source_type: str
    status: str
    row_count: int
    column_count: int
    quality_score: float
    last_modified: datetime


class ProjectCreate(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )
    name: str = Field(..., min_length=1, max_length=255, description="Project name")
    source_type: str = Field(
        ..., description="Source type: url, pdf, csv, api, excel, image, or json"
    )
    config: dict = Field(default_factory=dict, description="Project configuration")

    @field_validator("source_type")
    @classmethod
    def validate_source_type(cls, v: str) -> str:
        valid_types = {"url", "pdf", "csv", "api", "excel", "image", "json"}
        if v.lower() not in valid_types:
            raise ValueError(
                f"Invalid source_type. Must be one of: {', '.join(sorted(valid_types))}"
            )
        return v.lower()

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Project name cannot be empty")
        return v.strip()

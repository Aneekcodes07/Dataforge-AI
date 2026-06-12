"""
AI Copilot Pydantic schemas.
"""

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel
from datetime import datetime
from typing import Optional


class CopilotSessionResponse(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )
    id: str
    user_id: str
    title: str
    created_at: datetime
    updated_at: datetime


class CopilotMessageResponse(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )
    id: str
    session_id: str
    sender: str
    text: str
    card_type: Optional[str] = None
    card_data: Optional[dict] = None
    created_at: datetime


class CopilotSessionCreate(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )
    title: str = Field(default="New Conversation")


class CopilotQueryRequest(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )
    text: str = Field(..., min_length=1)

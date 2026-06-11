"""
Monitoring Pydantic validation schemas.
"""

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel
from datetime import datetime
from typing import Optional


class NotificationResponse(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )
    id: str
    user_id: str
    type: str
    title: str
    content: str
    link: Optional[str] = None
    is_read: bool
    created_at: datetime


class ActivityLogResponse(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )
    id: str
    workspace_id: str
    user_id: Optional[str] = None
    event_type: str
    description: str
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime

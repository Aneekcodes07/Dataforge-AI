"""AI usage reporting endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from src.ai.llm import ProviderNotConfiguredError, get_gateway
from src.ai.models import LLMUsageEvent
from src.ai.rag import get_vector_store, semantic_search
from src.auth.models import User, WorkspaceMembership
from src.auth.router import get_current_user
from src.core.database import get_db

router = APIRouter()


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)
    datasetId: str | None = None
    topK: int = Field(5, ge=1, le=20)


@router.get("/usage")
def get_usage(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the active workspace's LLM usage and cost summary."""
    membership = (
        db.query(WorkspaceMembership)
        .filter(WorkspaceMembership.user_id == current_user.id)
        .first()
    )
    empty = {
        "totalRequests": 0,
        "totalTokens": 0,
        "totalCostUsd": 0.0,
        "byFeature": [],
        "byModel": [],
    }
    if not membership:
        return empty

    base = db.query(LLMUsageEvent).filter(
        LLMUsageEvent.workspace_id == membership.workspace_id
    )

    totals = base.with_entities(
        func.count(LLMUsageEvent.id),
        func.coalesce(func.sum(LLMUsageEvent.total_tokens), 0),
        func.coalesce(func.sum(LLMUsageEvent.cost_usd), 0),
    ).one()

    by_feature = (
        base.with_entities(
            LLMUsageEvent.feature,
            func.count(LLMUsageEvent.id),
            func.coalesce(func.sum(LLMUsageEvent.total_tokens), 0),
            func.coalesce(func.sum(LLMUsageEvent.cost_usd), 0),
        )
        .group_by(LLMUsageEvent.feature)
        .all()
    )
    by_model = (
        base.with_entities(
            LLMUsageEvent.provider,
            LLMUsageEvent.model,
            func.count(LLMUsageEvent.id),
            func.coalesce(func.sum(LLMUsageEvent.total_tokens), 0),
            func.coalesce(func.sum(LLMUsageEvent.cost_usd), 0),
        )
        .group_by(LLMUsageEvent.provider, LLMUsageEvent.model)
        .all()
    )

    return {
        "totalRequests": int(totals[0]),
        "totalTokens": int(totals[1]),
        "totalCostUsd": round(float(totals[2]), 6),
        "byFeature": [
            {
                "feature": row[0],
                "requests": int(row[1]),
                "tokens": int(row[2]),
                "costUsd": round(float(row[3]), 6),
            }
            for row in by_feature
        ],
        "byModel": [
            {
                "provider": row[0],
                "model": row[1],
                "requests": int(row[2]),
                "tokens": int(row[3]),
                "costUsd": round(float(row[4]), 6),
            }
            for row in by_model
        ],
    }


@router.post("/search")
def semantic_search_endpoint(
    request: SearchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Semantic search across the active workspace's indexed datasets."""
    membership = (
        db.query(WorkspaceMembership)
        .filter(WorkspaceMembership.user_id == current_user.id)
        .first()
    )
    if not membership:
        return {"results": []}

    try:
        gateway = get_gateway()
    except ProviderNotConfiguredError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No AI provider is configured for embeddings/search",
        )

    results = semantic_search(
        vector_store=get_vector_store(),
        gateway=gateway,
        workspace_id=str(membership.workspace_id),
        query=request.query,
        top_k=request.topK,
        dataset_id=request.datasetId,
    )
    return {
        "results": [
            {
                "content": r.content,
                "score": round(r.score, 4),
                "datasetId": r.dataset_id,
                "chunkIndex": r.chunk_index,
                "metadata": r.metadata,
            }
            for r in results
        ]
    }

"""Copilot tools — real, workspace-scoped queries over platform data.

Each tool returns a :class:`ToolResult` containing a factual context string (used
to ground the LLM and as a no-LLM fallback) and a structured ``card`` rendered by
the UI. Imports of ORM models happen at module load; this module is imported
lazily by the service so the pure routing/prompt logic stays dependency-free.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from src.datasets.models import Dataset, DatasetColumn
from src.monitoring.models import AgentMetrics
from src.pipelines.models import Pipeline, PipelineRun


@dataclass
class ToolResult:
    context: str
    card_type: str | None = None
    card_data: dict = field(default_factory=dict)


def _ws(workspace_id: str) -> uuid.UUID:
    return uuid.UUID(workspace_id)


def get_failed_runs(db: Session, workspace_id: str) -> ToolResult:
    runs = (
        db.query(PipelineRun)
        .join(Pipeline, PipelineRun.pipeline_id == Pipeline.id)
        .filter(
            Pipeline.workspace_id == _ws(workspace_id),
            PipelineRun.status == "failed",
        )
        .order_by(PipelineRun.created_at.desc())
        .limit(5)
        .all()
    )
    if not runs:
        return ToolResult("No failed pipeline runs were found in this workspace.")

    items = []
    lines = []
    for run in runs:
        pipeline_name = run.pipeline.name if run.pipeline else "unknown"
        error = run.error_message or "failed without a recorded error"
        items.append({"runId": str(run.id), "pipeline": pipeline_name, "error": error})
        lines.append(f"- {pipeline_name}: {error}")
    context = f"{len(runs)} failed run(s) in this workspace:\n" + "\n".join(lines)
    return ToolResult(context, "pipeline", {"failedCount": len(runs), "runs": items})


def get_dataset_quality(db: Session, workspace_id: str) -> ToolResult:
    datasets = (
        db.query(Dataset)
        .filter(Dataset.workspace_id == _ws(workspace_id), Dataset.status == "Ready")
        .order_by(Dataset.quality_score.asc())
        .limit(5)
        .all()
    )
    if not datasets:
        return ToolResult("No completed datasets are available yet.")

    items = [
        {
            "name": d.name,
            "qualityScore": float(d.quality_score),
            "rowCount": d.record_count,
            "columnCount": d.column_count,
        }
        for d in datasets
    ]
    worst = datasets[0]
    warning_cols = (
        db.query(DatasetColumn)
        .filter(
            DatasetColumn.dataset_id == worst.id,
            DatasetColumn.status == "warning",
        )
        .all()
    )
    issues = [f"{c.name} ({float(c.null_rate):.1f}% null)" for c in warning_cols]
    context = (
        f"Lowest-quality dataset '{worst.name}' scores "
        f"{float(worst.quality_score):.1f}%. "
        + (f"Flagged columns: {', '.join(issues)}." if issues else "No column issues.")
    )
    return ToolResult(
        context,
        "dataset",
        {
            "datasets": items,
            "worst": {
                "name": worst.name,
                "score": float(worst.quality_score),
                "issues": issues,
            },
        },
    )


def propose_cleaning_rules(db: Session, workspace_id: str) -> ToolResult:
    cols = (
        db.query(DatasetColumn)
        .join(Dataset, DatasetColumn.dataset_id == Dataset.id)
        .filter(
            Dataset.workspace_id == _ws(workspace_id),
            DatasetColumn.status == "warning",
        )
        .limit(25)
        .all()
    )
    if not cols:
        return ToolResult("No data quality issues require cleaning right now.")

    imputations = []
    coercions = []
    for col in cols:
        if float(col.null_rate) > 0:
            imputations.append(
                {"field": col.name, "method": "default", "fillValue": ""}
            )
        if col.dtype in ("integer", "float"):
            coercions.append({"field": col.name, "rule": f"numeric_{col.dtype}"})
    context = (
        f"Proposed cleaning: {len(imputations)} imputation(s) and "
        f"{len(coercions)} type coercion(s) across flagged columns."
    )
    return ToolResult(
        context, "cleaning", {"imputations": imputations, "coercions": coercions}
    )


def get_agent_status(db: Session, workspace_id: str) -> ToolResult:
    metrics = (
        db.query(AgentMetrics)
        .join(PipelineRun, AgentMetrics.run_id == PipelineRun.id)
        .join(Pipeline, PipelineRun.pipeline_id == Pipeline.id)
        .filter(Pipeline.workspace_id == _ws(workspace_id))
        .order_by(AgentMetrics.recorded_at.desc())
        .limit(6)
        .all()
    )
    if not metrics:
        return ToolResult("No agent telemetry has been recorded yet.")

    agents = [
        {
            "agent": m.agent_type,
            "status": m.status,
            "throughput": float(m.throughput),
            "queueSize": m.queue_size,
            "runtimeSeconds": m.runtime_seconds,
        }
        for m in metrics
    ]
    context = "Most recent agent activity: " + "; ".join(
        f"{a['agent']} {a['status']} ({a['throughput']:.0f}/s)" for a in agents
    )
    return ToolResult(context, "agent", {"agents": agents})


def suggest_optimizations(db: Session, workspace_id: str) -> ToolResult:
    runs = (
        db.query(PipelineRun)
        .join(Pipeline, PipelineRun.pipeline_id == Pipeline.id)
        .filter(
            Pipeline.workspace_id == _ws(workspace_id),
            PipelineRun.status == "completed",
        )
        .order_by(PipelineRun.finished_at.desc())
        .limit(10)
        .all()
    )
    durations = [r.duration_seconds for r in runs if r.duration_seconds]
    avg_duration = round(sum(durations) / len(durations), 1) if durations else 0
    recommendations = [
        "Index newly generated datasets for semantic search to speed up Copilot answers.",
        "Disable OCR for sources that already contain a digital text layer.",
        "Batch small uploads to reduce per-run overhead.",
    ]
    context = (
        f"Across {len(runs)} recent completed runs the average duration is "
        f"{avg_duration}s. Recommendations: " + " ".join(recommendations)
    )
    return ToolResult(
        context,
        "optimization",
        {"avgDurationSeconds": avg_duration, "recommendations": recommendations},
    )

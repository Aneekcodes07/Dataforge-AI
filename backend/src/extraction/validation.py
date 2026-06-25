"""Validation and quality profiling of extracted records (pure stdlib)."""

from __future__ import annotations

from src.extraction.coerce import coerce_value, is_null
from src.extraction.types import ColumnProfile, Schema, ValidationResult

_SAMPLE_LIMIT = 5
_NULL_WARN_THRESHOLD = 5.0  # percent
_CONFORMANCE_WARN_THRESHOLD = 95.0  # percent


def validate_and_profile(records: list[dict], schema: Schema) -> ValidationResult:
    """Compute per-column profiles and an overall quality score (0..100)."""
    total = len(records)
    if total == 0 or not schema.fields:
        return ValidationResult(
            quality_score=0.0,
            column_profiles=[],
            issues=["No records were extracted"] if total == 0 else [],
            record_count=total,
        )

    profiles: list[ColumnProfile] = []
    issues: list[str] = []
    completeness_sum = 0.0
    validity_sum = 0.0

    for field in schema.fields:
        values = [rec.get(field.name) for rec in records]
        non_null = [v for v in values if not is_null(v)]
        null_count = total - len(non_null)
        null_rate = (null_count / total) * 100.0

        conforming = sum(1 for v in non_null if coerce_value(v, field.dtype)[1])
        conformance = (conforming / len(non_null) * 100.0) if non_null else 100.0

        distinct: list = []
        seen: set = set()
        for v in non_null:
            key = str(v)
            if key not in seen:
                seen.add(key)
                if len(distinct) < _SAMPLE_LIMIT:
                    distinct.append(v)

        status = "valid"
        if (
            null_rate > _NULL_WARN_THRESHOLD
            or conformance < _CONFORMANCE_WARN_THRESHOLD
        ):
            status = "warning"
            if null_rate > _NULL_WARN_THRESHOLD:
                issues.append(f"Column '{field.name}' is {null_rate:.1f}% empty")
            if conformance < _CONFORMANCE_WARN_THRESHOLD:
                issues.append(
                    f"Column '{field.name}' has values not matching type "
                    f"'{field.dtype}'"
                )

        profiles.append(
            ColumnProfile(
                name=field.name,
                dtype=field.dtype,
                null_rate=null_rate,
                unique_count=len(seen),
                sample_values=distinct,
                status=status,
            )
        )
        completeness_sum += 1.0 - (null_rate / 100.0)
        validity_sum += conformance / 100.0

    field_count = len(schema.fields)
    completeness = completeness_sum / field_count
    validity = validity_sum / field_count
    quality = max(0.0, min(100.0, 100.0 * (0.6 * completeness + 0.4 * validity)))

    return ValidationResult(
        quality_score=round(quality, 2),
        column_profiles=profiles,
        issues=issues,
        record_count=total,
    )

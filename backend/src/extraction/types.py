"""Shared extraction types: schema fields, profiles, and results."""

from __future__ import annotations

from dataclasses import dataclass, field

DTYPES = ("string", "integer", "float", "boolean", "datetime", "json")


class ExtractionError(Exception):
    """Raised when extraction cannot produce a valid result."""


@dataclass
class FieldSpec:
    name: str
    dtype: str = "string"
    description: str = ""
    required: bool = False

    def __post_init__(self) -> None:
        if self.dtype not in DTYPES:
            self.dtype = "string"

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "dtype": self.dtype,
            "description": self.description,
            "required": self.required,
        }

    @staticmethod
    def from_dict(data: dict) -> "FieldSpec":
        return FieldSpec(
            name=str(data.get("name", "")).strip(),
            dtype=str(data.get("dtype", "string")),
            description=str(data.get("description", "")),
            required=bool(data.get("required", False)),
        )


@dataclass
class Schema:
    fields: list[FieldSpec] = field(default_factory=list)

    @property
    def names(self) -> list[str]:
        return [f.name for f in self.fields]

    def to_dict(self) -> dict:
        return {"fields": [f.to_dict() for f in self.fields]}

    @staticmethod
    def from_dict(data: dict) -> "Schema":
        return Schema(
            fields=[
                FieldSpec.from_dict(f) for f in data.get("fields", []) if f.get("name")
            ]
        )

    def __bool__(self) -> bool:
        return bool(self.fields)


@dataclass
class ColumnProfile:
    name: str
    dtype: str
    null_rate: float  # 0..100
    unique_count: int
    sample_values: list
    status: str  # 'valid' | 'warning'

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "dtype": self.dtype,
            "nullRate": round(self.null_rate, 2),
            "uniqueCount": self.unique_count,
            "sampleValues": self.sample_values,
            "status": self.status,
        }


@dataclass
class ValidationResult:
    quality_score: float  # 0..100
    column_profiles: list[ColumnProfile]
    issues: list[str]
    record_count: int

    def to_dict(self) -> dict:
        return {
            "qualityScore": round(self.quality_score, 2),
            "recordCount": self.record_count,
            "columns": [c.to_dict() for c in self.column_profiles],
            "issues": self.issues,
        }

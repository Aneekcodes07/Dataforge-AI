"""Value coercion and dtype inference (pure standard library)."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

_BOOL_TRUE = {"true", "1", "yes", "y", "t"}
_BOOL_FALSE = {"false", "0", "no", "n", "f"}


def is_null(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str) and value.strip() == "":
        return True
    return False


def _is_int(value: Any) -> bool:
    if isinstance(value, bool):
        return False
    if isinstance(value, int):
        return True
    if isinstance(value, str):
        s = value.strip()
        if s.startswith(("+", "-")):
            s = s[1:]
        return s.isdigit()
    return False


def _is_float(value: Any) -> bool:
    if isinstance(value, bool):
        return False
    if isinstance(value, (int, float)):
        return True
    if isinstance(value, str):
        try:
            float(value.strip())
            return True
        except ValueError:
            return False
    return False


def _is_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return True
    if isinstance(value, str):
        return value.strip().lower() in (_BOOL_TRUE | _BOOL_FALSE)
    return False


def _is_datetime(value: Any) -> bool:
    if isinstance(value, (datetime, date)):
        return True
    if isinstance(value, str):
        return _parse_datetime(value.strip()) is not None
    return False


def _parse_datetime(value: str) -> datetime | None:
    for fmt in (None, "%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%m/%d/%Y"):
        try:
            if fmt is None:
                return datetime.fromisoformat(value)
            return datetime.strptime(value, fmt)
        except ValueError:
            continue
    return None


def infer_dtype(values: list[Any]) -> str:
    """Infer the most specific dtype that fits every non-null value."""
    non_null = [v for v in values if not is_null(v)]
    if not non_null:
        return "string"
    if all(_is_int(v) for v in non_null):
        return "integer"
    if all(_is_float(v) for v in non_null):
        return "float"
    if all(_is_bool(v) for v in non_null):
        return "boolean"
    if all(_is_datetime(v) for v in non_null):
        return "datetime"
    return "string"


def coerce_value(value: Any, dtype: str) -> tuple[Any, bool]:
    """Coerce ``value`` to ``dtype``. Returns (coerced_value, ok).

    Null values coerce to None with ok=True (nullability handled separately).
    A value that cannot be coerced returns (None, False).
    """
    if is_null(value):
        return None, True
    try:
        if dtype == "integer":
            if isinstance(value, bool):
                return None, False
            return int(str(value).strip()), True
        if dtype == "float":
            if isinstance(value, bool):
                return None, False
            return float(str(value).strip()), True
        if dtype == "boolean":
            if isinstance(value, bool):
                return value, True
            s = str(value).strip().lower()
            if s in _BOOL_TRUE:
                return True, True
            if s in _BOOL_FALSE:
                return False, True
            return None, False
        if dtype == "datetime":
            if isinstance(value, datetime):
                return value.isoformat(), True
            if isinstance(value, date):
                return value.isoformat(), True
            parsed = _parse_datetime(str(value).strip())
            return (parsed.isoformat(), True) if parsed else (None, False)
        if dtype == "json":
            return value, True
        # string
        return str(value), True
    except (ValueError, TypeError):
        return None, False

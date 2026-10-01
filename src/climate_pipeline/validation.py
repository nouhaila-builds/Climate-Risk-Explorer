"""Validation rules for raw and processed climate tables."""

from __future__ import annotations

from climate_pipeline.indicators import is_missing
from climate_pipeline.schema import ANNUAL_METRICS, YEAR_END, YEAR_START


class ValidationError(Exception):
    def __init__(self, errors: list[str]):
        self.errors = errors
        super().__init__("; ".join(errors[:8]))


def validate_raw_rows(rows: list[dict]) -> list[str]:
    errors: list[str] = []
    seen: set[tuple] = set()
    if not rows:
        return ["raw dataset is empty"]
    for index, row in enumerate(rows):
        code = row.get("country_code")
        year = row.get("year")
        month = row.get("month")
        if not code:
            errors.append(f"row {index} is missing country_code")
            continue
        if year is None or month is None:
            errors.append(f"row {index} is missing year or month")
            continue
        key = (code, int(year), int(month))
        if key in seen:
            errors.append(f"duplicate raw key {key}")
        seen.add(key)
        temp = row.get("temperature")
        if temp is not None and not is_missing(temp) and not (-80 <= float(temp) <= 60):
            errors.append(f"{key} temperature out of range")
        precip = row.get("precipitation")
        if precip is not None and not is_missing(precip) and float(precip) < 0:
            errors.append(f"{key} precipitation is negative")
        heat = row.get("heat_days")
        if heat is not None and not is_missing(heat) and float(heat) < 0:
            errors.append(f"{key} heat_days is negative")
        if len(errors) > 40:
            break
    return errors


def validate_processed(payload: dict, required_codes: list[str] | None = None) -> list[str]:
    errors: list[str] = []
    years = payload.get("years") or []
    expected = list(range(YEAR_START, YEAR_END + 1))
    if years != expected:
        errors.append("processed years do not cover 1980–2025")
    regions = payload.get("regions") or []
    codes = [region["code"] for region in regions]
    if len(codes) != len(set(codes)):
        errors.append("duplicate region codes")
    for code in required_codes or []:
        if code not in codes:
            errors.append(f"missing required region {code}")
    series = payload.get("series") or {}
    for code in codes:
        record = series.get(code)
        if record is None:
            errors.append(f"{code} has no series")
            continue
        for metric in ANNUAL_METRICS:
            values = record.get(metric)
            if values is None or len(values) != len(years):
                errors.append(f"{code}.{metric} length mismatch")
                continue
            for year, value in zip(years, values):
                if is_missing(value):
                    continue
                number = float(value)
                if metric == "heat_days" and number < 0:
                    errors.append(f"{code} {year} negative heat_days")
                if metric.endswith("_risk") or metric == "drought_index":
                    if not 0 <= number <= 100:
                        errors.append(f"{code} {year} {metric} outside 0–100")
                if metric == "coverage" and number not in (0.0, 1.0):
                    errors.append(f"{code} {year} coverage is not 0 or 1")
                if metric == "temperature" and not -80 <= number <= 60:
                    errors.append(f"{code} {year} temperature out of range")
        if len(errors) > 40:
            break
    return errors


def assert_valid(errors: list[str]) -> None:
    if errors:
        raise ValidationError(errors)

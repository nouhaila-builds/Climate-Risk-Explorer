"""Sentence-level descriptions computed from indicator statistics.

Language is descriptive. It does not claim a physical cause.
Thresholds here are the narrative contract shared with the frontend.
"""

from __future__ import annotations

from climate_pipeline.indicators import is_missing


def change_phrase(percent: float | None) -> str:
    if percent is None or is_missing(percent):
        return "could not be compared with the baseline because the sample is incomplete"
    if percent >= 40:
        return "increased substantially"
    if percent >= 10:
        return "increased"
    if percent > -10:
        return "remained relatively stable"
    if percent > -40:
        return "decreased"
    return "decreased substantially"


def level_phrase(anomaly: float | None, unit: str = "") -> str:
    if anomaly is None or is_missing(anomaly):
        return "has no baseline comparison"
    suffix = f" {unit}".rstrip()
    if abs(anomaly) < (0.15 if unit == "°C" else 3):
        return f"is close to the baseline ({anomaly:+.1f}{suffix})"
    if anomaly > 0:
        return f"is above the baseline ({anomaly:+.1f}{suffix})"
    return f"is below the baseline ({anomaly:+.1f}{suffix})"


def trend_phrase(slope: float | None, stderr: float | None, unit: str) -> str:
    """Describe a slope only when it clears a 95% noise band."""
    if slope is None or stderr is None:
        return "does not have a stable trend estimate"
    if abs(slope) <= 1.96 * stderr:
        return "shows no clear trend over the selected years"
    per_decade = slope * 10
    direction = "increasing" if slope > 0 else "decreasing"
    return f"is {direction} by about {abs(per_decade):.1f} {unit} per decade"


def association_phrase(correlation: float | None, left: str, right: str) -> str:
    if correlation is None:
        return f"{left} and {right} cannot be compared because the overlap is too short."
    magnitude = abs(correlation)
    if magnitude < 0.4:
        return (
            f"In this simulated series, {left} and {right} do not show a strong "
            f"linear association (r = {correlation:.2f})."
        )
    direction = "move together" if correlation > 0 else "move in opposite directions"
    return (
        f"In this simulated series, {left} and {right} {direction} "
        f"(r = {correlation:.2f})."
    )


def baseline_sentence(
    region: str,
    metric_label: str,
    percent: float | None,
    recent: float | None,
    baseline: float | None,
    unit: str,
    baseline_start: int,
    baseline_end: int,
) -> str:
    phrase = change_phrase(percent)
    if recent is None or baseline is None or percent is None:
        return (
            f"{metric_label} in {region} {phrase} for the selected years "
            f"against the {baseline_start}–{baseline_end} baseline."
        )
    return (
        f"{metric_label} in {region} {phrase} relative to the "
        f"{baseline_start}–{baseline_end} baseline "
        f"({recent:.1f} vs {baseline:.1f} {unit} per year, {percent:+.0f}%)."
    )

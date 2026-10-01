"""Transparent climate-indicator calculations.

Missing values stay missing. No function in this module replaces a gap with zero.

The formulas describe this project’s analytical definitions. Applied to the
bundled dataset, they summarize a seeded simulation — not a national
observational record.
"""

from __future__ import annotations

import math
from typing import Sequence

from climate_pipeline.schema import (
    HEAT_DAYS_SATURATION,
    MIN_BASELINE_POINTS,
    MIN_PERCENTILE_POINTS,
    MIN_TREND_POINTS,
    OVERALL_WEIGHTS,
    PRECIP_RATIO_HIGH,
    PRECIP_RATIO_LOW,
    ROLLING_WINDOW,
)

Number = float | int | None


def is_missing(value: Number) -> bool:
    if value is None:
        return True
    try:
        return math.isnan(float(value))
    except (TypeError, ValueError):
        return True


def linear_scale(value: Number, low: float, high: float) -> float | None:
    """Clip a value into a 0–100 index between fixed breakpoints.

    Returns None when the input is missing or the scale is degenerate.
    """
    if is_missing(value) or high == low:
        return None
    scaled = (float(value) - low) / (high - low) * 100.0
    return max(0.0, min(100.0, scaled))


def heat_risk_index(heat_days: Number) -> float | None:
    """0 hot-days → 0, 72 hot-days → 100. Values above 72 stay at 100."""
    return linear_scale(heat_days, 0.0, HEAT_DAYS_SATURATION)


def precipitation_risk_index(peak_ratio: Number) -> float | None:
    """1.0× the monthly climatology → 0, 2.2× → 100."""
    return linear_scale(peak_ratio, PRECIP_RATIO_LOW, PRECIP_RATIO_HIGH)


def overall_risk_index(components: dict[str, Number]) -> float | None:
    """Weighted mean of the six hazard indices.

    If any component is missing, the overall index is missing. Weights are not
    silently redistributed, so a partial year cannot look like a real score.
    """
    total = 0.0
    for key, weight in OVERALL_WEIGHTS.items():
        value = components.get(key)
        if is_missing(value):
            return None
        total += float(value) * weight
    return total


def baseline_mean(
    years: Sequence[int],
    values: Sequence[Number],
    start: int,
    end: int,
    min_points: int = MIN_BASELINE_POINTS,
) -> float | None:
    """Mean of non-missing observations inside [start, end].

    Returns None when fewer than `min_points` observations are available.
    """
    if start > end:
        return None
    sample = [
        float(value)
        for year, value in zip(years, values)
        if start <= int(year) <= end and not is_missing(value)
    ]
    if len(sample) < min_points:
        return None
    return sum(sample) / len(sample)


def period_mean(
    years: Sequence[int],
    values: Sequence[Number],
    start: int,
    end: int,
    min_points: int = 1,
) -> float | None:
    return baseline_mean(years, values, start, end, min_points=min_points)


def anomaly(value: Number, baseline: Number) -> float | None:
    """current − baseline. None if either side is missing."""
    if is_missing(value) or is_missing(baseline):
        return None
    return float(value) - float(baseline)


def percent_change(recent: Number, baseline: Number) -> float | None:
    """Percent change versus baseline. None when baseline is missing or zero."""
    if is_missing(recent) or is_missing(baseline) or float(baseline) == 0.0:
        return None
    return (float(recent) - float(baseline)) / abs(float(baseline)) * 100.0


def rolling_mean(values: Sequence[Number], window: int = ROLLING_WINDOW) -> list[float | None]:
    """Trailing mean. A window that contains a gap or is incomplete is None."""
    if window < 1:
        raise ValueError("window must be positive")
    out: list[float | None] = []
    for index in range(len(values)):
        if index + 1 < window:
            out.append(None)
            continue
        window_values = values[index + 1 - window : index + 1]
        if any(is_missing(value) for value in window_values):
            out.append(None)
            continue
        out.append(sum(float(value) for value in window_values) / window)
    return out


def linear_trend(
    years: Sequence[int],
    values: Sequence[Number],
    min_points: int = MIN_TREND_POINTS,
) -> dict[str, float | int | bool | None]:
    """Ordinary least squares of value on year.

    Slope is expressed per year. `stderr` is the standard error of the slope.
    `sufficient` is False when there are too few points; slope is then None.
    """
    points = [
        (float(year), float(value))
        for year, value in zip(years, values)
        if not is_missing(value)
    ]
    n = len(points)
    empty: dict[str, float | int | bool | None] = {
        "slope": None,
        "intercept": None,
        "stderr": None,
        "sigma": None,
        "r_squared": None,
        "n": n,
        "sufficient": False,
        "x_mean": None,
        "sxx": None,
    }
    if n < min_points:
        return empty

    xs = [point[0] for point in points]
    ys = [point[1] for point in points]
    x_mean = sum(xs) / n
    y_mean = sum(ys) / n
    sxx = sum((x - x_mean) ** 2 for x in xs)
    syy = sum((y - y_mean) ** 2 for y in ys)
    sxy = sum((x - x_mean) * (y - y_mean) for x, y in points)
    if sxx == 0:
        return empty

    slope = sxy / sxx
    intercept = y_mean - slope * x_mean
    residual_sq = sum((y - (intercept + slope * x)) ** 2 for x, y in points)
    sigma2 = residual_sq / (n - 2)
    sigma = math.sqrt(sigma2)
    stderr = math.sqrt(sigma2 / sxx)
    r_squared = None if syy == 0 else 1 - residual_sq / syy
    return {
        "slope": slope,
        "intercept": intercept,
        "stderr": stderr,
        "sigma": sigma,
        "r_squared": r_squared,
        "n": n,
        "sufficient": True,
        "x_mean": x_mean,
        "sxx": sxx,
    }


def trend_interval(trend: dict, year: float, z: float = 1.96) -> tuple[float, float] | None:
    """95% confidence interval for the mean response at `year`."""
    if not trend.get("sufficient"):
        return None
    sigma = trend["sigma"]
    x_mean = trend["x_mean"]
    sxx = trend["sxx"]
    n = trend["n"]
    if sigma is None or x_mean is None or sxx in (None, 0) or not n:
        return None
    fitted = float(trend["intercept"]) + float(trend["slope"]) * year
    se = float(sigma) * math.sqrt(1 / float(n) + (year - float(x_mean)) ** 2 / float(sxx))
    return fitted - z * se, fitted + z * se


def percentile_rank(value: Number, reference: Sequence[Number]) -> float | None:
    """Percent of reference observations less than or equal to `value`."""
    if is_missing(value):
        return None
    sample = [float(item) for item in reference if not is_missing(item)]
    if len(sample) < MIN_PERCENTILE_POINTS:
        return None
    target = float(value)
    return 100.0 * sum(1 for item in sample if item <= target) / len(sample)


def pearson(xs: Sequence[Number], ys: Sequence[Number]) -> float | None:
    """Pearson correlation. None when fewer than 8 complete pairs exist."""
    pairs = [
        (float(x), float(y))
        for x, y in zip(xs, ys)
        if not is_missing(x) and not is_missing(y)
    ]
    n = len(pairs)
    if n < MIN_TREND_POINTS:
        return None
    x_mean = sum(pair[0] for pair in pairs) / n
    y_mean = sum(pair[1] for pair in pairs) / n
    sxx = sum((x - x_mean) ** 2 for x, _ in pairs)
    syy = sum((y - y_mean) ** 2 for _, y in pairs)
    sxy = sum((x - x_mean) * (y - y_mean) for x, y in pairs)
    if sxx == 0 or syy == 0:
        return None
    return sxy / math.sqrt(sxx * syy)


def coverage_ratio(coverage: Sequence[Number]) -> float | None:
    if not coverage:
        return None
    observed = [value for value in coverage if not is_missing(value)]
    if not observed:
        return None
    return sum(float(value) for value in observed) / len(observed)


def normal_survival(z: float) -> float:
    """Upper tail of the standard normal distribution."""
    return 0.5 * math.erfc(z / math.sqrt(2.0))


def estimated_hot_days(
    monthly_mean: float,
    month_days: int,
    tmax_offset: float,
    sigma: float,
    threshold: float = 30.0,
) -> float:
    """Proxy for days with daily maximum temperature above `threshold`.

    Daily maxima are assumed normal, centered at monthly mean + tmax_offset,
    with standard deviation `sigma`. This is not a count from daily observations.
    Leap days are ignored (February has 28 days).
    """
    if sigma <= 0:
        return 0.0
    center = monthly_mean + tmax_offset
    z = (threshold - center) / sigma
    days = month_days * normal_survival(z)
    return max(0.0, min(float(month_days), days))

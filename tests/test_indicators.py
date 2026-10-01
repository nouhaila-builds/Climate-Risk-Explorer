import math

import pytest

from climate_pipeline.indicators import (
    anomaly,
    baseline_mean,
    heat_risk_index,
    linear_scale,
    linear_trend,
    overall_risk_index,
    percent_change,
    percentile_rank,
    rolling_mean,
    trend_interval,
)
from climate_pipeline.insights import change_phrase, trend_phrase
from climate_pipeline.schema import OVERALL_WEIGHTS


def test_anomaly_is_difference_from_baseline():
    years = [1980, 1981, 1982, 1983, 1984, 1985]
    values = [10, 10, 10, 10, 10, 12]
    base = baseline_mean(years, values, 1980, 1984)
    assert base == pytest.approx(10)
    assert anomaly(12, base) == pytest.approx(2)


def test_short_baseline_stays_missing():
    years = [1980, 1981, 1982, 1983]
    values = [1, 2, 3, 4]
    assert baseline_mean(years, values, 1980, 1983, min_points=5) is None


def test_missing_values_are_not_treated_as_zero():
    years = list(range(1980, 1990))
    values = [None, None, None, None, 5, 5, 5, 5, 5, 5]
    assert baseline_mean(years, values, 1980, 1984) is None
    assert anomaly(None, 5) is None
    assert percent_change(10, 0) is None
    assert percent_change(None, 10) is None


def test_percent_change():
    assert percent_change(22.7, 12.4) == pytest.approx((22.7 - 12.4) / 12.4 * 100)


def test_rolling_mean_breaks_on_gaps():
    values = [1, 2, 3, 4, 5, None, 7, 8, 9, 10]
    rolled = rolling_mean(values, window=5)
    assert rolled[4] == pytest.approx(3)
    assert rolled[5] is None
    assert rolled[6] is None
    assert rolled[:4] == [None, None, None, None]


def test_linear_trend_exact_line_has_no_error():
    years = list(range(1980, 1996))
    values = [2.0 * (year - 1980) + 1 for year in years]
    trend = linear_trend(years, values)
    assert trend["sufficient"] is True
    assert trend["slope"] == pytest.approx(2.0)
    assert trend["stderr"] == pytest.approx(0.0, abs=1e-9)
    band = trend_interval(trend, 1990)
    assert band is not None
    assert band[0] == pytest.approx(band[1])


def test_trend_refuses_small_samples():
    trend = linear_trend([1980, 1981, 1982], [1, 2, 3], min_points=8)
    assert trend["sufficient"] is False
    assert trend["slope"] is None


def test_risk_scale_clips_and_preserves_missing():
    assert linear_scale(None, 0, 48) is None
    assert linear_scale(-5, 0, 48) == 0
    assert heat_risk_index(0) == 0
    assert heat_risk_index(72) == pytest.approx(100)
    assert heat_risk_index(36) == pytest.approx(50)
    assert heat_risk_index(None) is None


def test_overall_risk_requires_every_component():
    components = {key: 40 for key in OVERALL_WEIGHTS}
    assert overall_risk_index(components) == pytest.approx(40)
    components["storm_risk"] = None
    assert overall_risk_index(components) is None


def test_percentile_rank():
    reference = list(range(10))
    assert percentile_rank(0, reference) == pytest.approx(10)
    assert percentile_rank(9, reference) == pytest.approx(100)
    assert percentile_rank(3, [1, 2]) is None


def test_change_and_trend_language():
    assert "substantially" in change_phrase(83)
    assert change_phrase(0) == "remained relatively stable"
    assert "incomplete" in change_phrase(None)
    text = trend_phrase(0.2, 0.01, "days")
    assert "increasing" in text
    assert "no clear trend" in trend_phrase(0.01, 0.02, "days")
    assert math.isfinite(heat_risk_index(10))

"""Analytical queries over the processed climate dataset.

The HTTP layer is thin on purpose: every number returned here comes from
`climate_pipeline.indicators` or from the stored simulation.
"""

from __future__ import annotations

import json
from pathlib import Path

from climate_pipeline.indicators import (
    anomaly,
    baseline_mean,
    coverage_ratio,
    linear_trend,
    pearson,
    percent_change,
    percentile_rank,
    period_mean,
    rolling_mean,
    trend_interval,
)
from climate_pipeline.insights import (
    association_phrase,
    baseline_sentence,
    change_phrase,
    trend_phrase,
)
from climate_pipeline.schema import (
    HAZARDS,
    HOTSPOT_WEIGHTS,
    MIN_BASELINE_POINTS,
    RELATED_HAZARD,
    ROLLING_WINDOW,
    YEAR_END,
    YEAR_START,
)

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ANNUAL = ROOT / "data" / "processed" / "climate.json"
DEFAULT_MONTHLY = ROOT / "data" / "processed" / "monthly.json"


class ClimateStore:
    def __init__(self, annual_path: Path | None = None, monthly_path: Path | None = None):
        annual_file = Path(annual_path or DEFAULT_ANNUAL)
        monthly_file = Path(monthly_path or DEFAULT_MONTHLY)
        self.annual = json.loads(annual_file.read_text(encoding="utf-8"))
        self.monthly = json.loads(monthly_file.read_text(encoding="utf-8")) if monthly_file.exists() else {"regions": {}}
        self.years: list[int] = self.annual["years"]
        self.regions = {region["code"]: region for region in self.annual["regions"]}
        self.series: dict[str, dict[str, list]] = self.annual["series"]

    @property
    def origin(self) -> dict:
        meta = self.annual["meta"]
        return {
            "data_origin": meta["data_origin"],
            "label": meta["label"],
            "notes": meta["notes"],
        }

    def require_region(self, code: str) -> dict:
        region = self.regions.get(code.upper())
        if region is None:
            raise KeyError(code)
        return region

    def require_hazard(self, hazard: str) -> dict:
        spec = HAZARDS.get(hazard)
        if spec is None:
            raise ValueError(hazard)
        return spec

    def _window(self, values: list, start: int, end: int) -> tuple[list[int], list]:
        years = []
        series = []
        for year, value in zip(self.years, values):
            if start <= year <= end:
                years.append(year)
                series.append(value)
        return years, series

    def metric(self, code: str, name: str) -> list:
        return self.series[code][name]

    def map_values(self, hazard: str, year: int, mode: str, baseline_start: int, baseline_end: int) -> dict:
        spec = self.require_hazard(hazard)
        if year not in self.years:
            raise KeyError(f"year:{year}")
        index = self.years.index(year)
        absolute_key = str(spec["absolute"])
        anomaly_key = str(spec["anomaly_source"])
        values: dict[str, float | None] = {}
        for code, series in self.series.items():
            if series["coverage"][index] in (0, 0.0, None):
                values[code] = None
                continue
            if mode == "anomaly":
                baseline = baseline_mean(self.years, series[anomaly_key], baseline_start, baseline_end)
                values[code] = _round(anomaly(series[anomaly_key][index], baseline), 2)
            else:
                values[code] = series[absolute_key][index]
        return values

    def profile(self, code: str, start: int, end: int, baseline_start: int, baseline_end: int) -> dict:
        region = self.require_region(code)
        code = region["code"]
        series = self.series[code]
        years, coverage = self._window(series["coverage"], start, end)
        observed = [value for value in coverage if value not in (0, 0.0, None)]
        if not observed:
            return {
                **self.origin,
                "region": region,
                "available": False,
                "message": "NO DATA AVAILABLE",
                "period": {"start": start, "end": end},
            }

        def summarize(metric: str) -> dict:
            values = series[metric]
            recent = period_mean(self.years, values, start, end, min_points=1)
            base = baseline_mean(self.years, values, baseline_start, baseline_end)
            current_year = min(end, YEAR_END)
            current = None
            if current_year in self.years:
                current_index = self.years.index(current_year)
                if series["coverage"][current_index] not in (0, 0.0, None):
                    current = values[current_index]
            return {
                "current": _round(current, 2),
                "period_mean": _round(recent, 2),
                "baseline_mean": _round(base, 2),
                "anomaly": _round(anomaly(recent, base), 2),
                "change_percent": _round(percent_change(recent, base), 1),
            }

        metrics = {
            "temperature": summarize("temperature"),
            "heat_days": summarize("heat_days"),
            "drought_index": summarize("drought_index"),
            "precipitation": summarize("precipitation"),
            "flood_risk": summarize("flood_risk"),
            "wildfire_risk": summarize("wildfire_risk"),
            "storm_risk": summarize("storm_risk"),
            "heat_risk": summarize("heat_risk"),
            "drought_risk": summarize("drought_risk"),
            "precipitation_risk": summarize("precipitation_risk"),
            "overall_risk": summarize("overall_risk"),
        }
        risks = {
            "heat": metrics["heat_risk"]["period_mean"],
            "drought": metrics["drought_risk"]["period_mean"],
            "flood": metrics["flood_risk"]["period_mean"],
            "precipitation": metrics["precipitation_risk"]["period_mean"],
            "wildfire": metrics["wildfire_risk"]["period_mean"],
            "storm": metrics["storm_risk"]["period_mean"],
        }
        return {
            **self.origin,
            "available": True,
            "region": region,
            "period": {"start": start, "end": end},
            "baseline": {"start": baseline_start, "end": baseline_end},
            "coverage": _round(coverage_ratio(coverage), 2),
            "sample_size": len(observed),
            "risks": risks,
            "metrics": metrics,
            "warning": _sample_warning(len(observed), baseline_start, baseline_end, series, "temperature"),
        }

    def trend(self, code: str, hazard: str, start: int, end: int, baseline_start: int, baseline_end: int) -> dict:
        region = self.require_region(code)
        spec = self.require_hazard(hazard)
        code = region["code"]
        detail = str(spec["detail"])
        values = self.series[code][detail]
        years, window = self._window(values, start, end)
        base = baseline_mean(self.years, values, baseline_start, baseline_end)
        trend = linear_trend(years, window)
        rolled = rolling_mean(window, ROLLING_WINDOW)
        points = []
        for year, value, smooth in zip(years, window, rolled):
            band = trend_interval(trend, year) if value is not None else None
            fitted = None
            if trend.get("sufficient") and value is not None:
                fitted = float(trend["intercept"]) + float(trend["slope"]) * year
            points.append(
                {
                    "year": year,
                    "value": value,
                    "rolling": _round(smooth, 2),
                    "baseline": _round(base, 2),
                    "anomaly": _round(anomaly(value, base), 2),
                    "fitted": _round(fitted, 2),
                    "band_low": _round(band[0], 2) if band else None,
                    "band_high": _round(band[1], 2) if band else None,
                    "percentile": _round(percentile_rank(value, values), 0),
                }
            )
        recent = period_mean(years, window, start, end, min_points=1)
        return {
            **self.origin,
            "region": region,
            "hazard": hazard,
            "metric": detail,
            "unit": spec["detail_unit"],
            "period": {"start": start, "end": end},
            "baseline": {"start": baseline_start, "end": baseline_end, "mean": _round(base, 2)},
            "trend": {
                "slope_per_year": _round(trend["slope"], 4),
                "slope_per_decade": _round(None if trend["slope"] is None else float(trend["slope"]) * 10, 2),
                "stderr": _round(trend["stderr"], 4),
                "r_squared": _round(trend["r_squared"], 3),
                "n": trend["n"],
                "sufficient": trend["sufficient"],
                "description": trend_phrase(trend["slope"], trend["stderr"], str(spec["detail_unit"])),
            },
            "change_percent": _round(percent_change(recent, base), 1),
            "change_phrase": change_phrase(percent_change(recent, base)),
            "points": points,
            "events": [event for event in self.events(code, hazard) if start <= event["year"] <= end],
        }

    def anomalies(self, code: str, baseline_start: int, baseline_end: int) -> dict:
        region = self.require_region(code)
        code = region["code"]
        series = self.series[code]
        metrics = {}
        for name in ("temperature", "heat_days", "precipitation", "drought_index", "flood_risk", "wildfire_risk", "storm_risk"):
            base = baseline_mean(self.years, series[name], baseline_start, baseline_end)
            metrics[name] = [
                {
                    "year": year,
                    "value": value,
                    "anomaly": _round(anomaly(value, base), 2),
                }
                for year, value in zip(self.years, series[name])
            ]
        return {
            **self.origin,
            "region": region,
            "baseline": {"start": baseline_start, "end": baseline_end},
            "metrics": metrics,
        }

    def seasonality(self, code: str, hazard: str, start: int, end: int) -> dict:
        region = self.require_region(code)
        spec = self.require_hazard(hazard)
        code = region["code"]
        monthly = self.monthly.get("regions", {}).get(code)
        if not monthly:
            return {**self.origin, "region": region, "available": False, "message": "NO DATA AVAILABLE"}
        key = {
            "heat": "heat_days",
            "drought": "drought_index",
            "flood": "precipitation",
            "precipitation": "precipitation",
            "wildfire": "drought_index",
            "storm": "precipitation",
        }[hazard]
        matrix = monthly[key]
        month_values: list[float | None] = []
        labels = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
        for month_index in range(12):
            sample = []
            for year, row in zip(self.years, matrix):
                if start <= year <= end and row[month_index] is not None:
                    sample.append(row[month_index])
            month_values.append(round(sum(sample) / len(sample), 2) if sample else None)
        valid = [(index, value) for index, value in enumerate(month_values) if value is not None]
        peak = []
        if valid:
            ranked = sorted(valid, key=lambda item: item[1], reverse=True)[:3]
            peak = sorted(index + 1 for index, _ in ranked)
        return {
            **self.origin,
            "available": True,
            "region": region,
            "hazard": hazard,
            "metric": key,
            "unit": "mm" if key == "precipitation" else spec["detail_unit"],
            "months": [
                {"month": index + 1, "label": labels[index], "value": value}
                for index, value in enumerate(month_values)
            ],
            "peak_months": peak,
        }

    def events(self, code: str, hazard: str | None = None) -> list[dict]:
        """Years above the 95th percentile of this region's own simulated series."""
        self.require_region(code)
        hazards = [hazard] if hazard else list(HAZARDS)
        found = []
        for hazard_id in hazards:
            if hazard_id not in HAZARDS:
                continue
            detail = str(HAZARDS[hazard_id]["detail"])
            values = self.series[code][detail]
            sample = sorted(float(value) for value in values if value is not None)
            if len(sample) < 8:
                continue
            cutoff = sample[min(len(sample) - 1, int(len(sample) * 0.95))]
            midpoint = sample[len(sample) // 2]
            if cutoff <= midpoint:
                continue
            for year, value in zip(self.years, values):
                if value is None or float(value) < cutoff:
                    continue
                found.append(
                    {
                        "year": year,
                        "hazard": hazard_id,
                        "value": value,
                        "title": f"Simulated extreme {HAZARDS[hazard_id]['short'].lower()} year",
                        "detail": (
                            "This year is at or above the 95th percentile of this region's "
                            "own simulated series. It is not a named historical disaster."
                        ),
                        "data_origin": "simulated",
                    }
                )
        found.sort(key=lambda item: item["year"])
        return found

    def hotspots(self, year: int, hazard: str | None, limit: int, baseline_start: int, baseline_end: int) -> dict:
        if year not in self.years:
            raise KeyError(f"year:{year}")
        index = self.years.index(year)
        hazard_ids = [hazard] if hazard else list(HAZARDS)
        rows = []
        for code, region in self.regions.items():
            series = self.series[code]
            if series["coverage"][index] in (0, 0.0, None):
                continue
            for hazard_id in hazard_ids:
                spec = HAZARDS[hazard_id]
                risk = series[str(spec["absolute"])][index]
                if risk is None:
                    continue
                source = series[str(spec["anomaly_source"])]
                base = baseline_mean(self.years, source, baseline_start, baseline_end)
                delta = anomaly(source[index], base)
                trend = linear_trend(self.years[: index + 1], source[: index + 1])
                slope = trend["slope"] if trend["sufficient"] else None
                concurrent = sum(
                    1
                    for other in HAZARDS.values()
                    if series[str(other["absolute"])][index] is not None
                    and float(series[str(other["absolute"])][index]) >= 65
                )
                anomaly_score = _anomaly_score(hazard_id, delta)
                trend_score = 0.0 if slope is None else max(0.0, min(100.0, float(slope) / _trend_scale(hazard_id) * 100))
                concurrent_score = concurrent / 6 * 100
                score = (
                    HOTSPOT_WEIGHTS["risk"] * float(risk)
                    + HOTSPOT_WEIGHTS["anomaly"] * anomaly_score
                    + HOTSPOT_WEIGHTS["trend"] * trend_score
                    + HOTSPOT_WEIGHTS["concurrent"] * concurrent_score
                )
                reasons = []
                if float(risk) >= 70:
                    reasons.append("high risk")
                if anomaly_score >= 60:
                    reasons.append("above baseline")
                if trend_score >= 55:
                    reasons.append("rapid increase")
                if concurrent >= 3:
                    reasons.append("multiple hazards")
                rows.append(
                    {
                        "score": round(score, 1),
                        "region": region,
                        "hazard": hazard_id,
                        "hazard_label": spec["label"],
                        "risk": risk,
                        "anomaly": _round(delta, 2),
                        "anomaly_unit": spec["anomaly_unit"],
                        "reasons": reasons,
                        "concurrent_hazards": concurrent,
                    }
                )
        rows.sort(key=lambda item: item["score"], reverse=True)
        # One row per region: keep its strongest hazard.
        chosen = []
        seen = set()
        for row in rows:
            if row["region"]["code"] in seen:
                continue
            seen.add(row["region"]["code"])
            chosen.append(row)
            if len(chosen) >= limit:
                break
        return {**self.origin, "year": year, "hotspots": chosen}

    def compare(self, codes: list[str], hazard: str, start: int, end: int, baseline_start: int, baseline_end: int) -> dict:
        if len(codes) > 4:
            raise ValueError("At most 4 regions can be compared.")
        spec = self.require_hazard(hazard)
        regions = []
        for code in codes:
            profile = self.profile(code, start, end, baseline_start, baseline_end)
            trend = self.trend(code, hazard, start, end, baseline_start, baseline_end)
            regions.append({"profile": profile, "trend": trend})
        return {**self.origin, "hazard": hazard, "unit": spec["detail_unit"], "regions": regions}

    def investigation(self, code: str, hazard: str, start: int, end: int, baseline_start: int, baseline_end: int) -> dict:
        region = self.require_region(code)
        spec = self.require_hazard(hazard)
        profile = self.profile(code, start, end, baseline_start, baseline_end)
        if not profile.get("available"):
            return {**self.origin, "available": False, "region": region, "message": "NO DATA AVAILABLE"}
        trend = self.trend(code, hazard, start, end, baseline_start, baseline_end)
        season = self.seasonality(code, hazard, start, end)
        related = RELATED_HAZARD[hazard]
        related_spec = HAZARDS[related]
        left = self.series[region["code"]][str(spec["absolute"])]
        right = self.series[region["code"]][str(related_spec["absolute"])]
        correlation = pearson(left, right)
        detail = str(spec["detail"])
        metric_summary = profile["metrics"][detail if detail in profile["metrics"] else "heat_days"]
        if detail == "flood_risk":
            metric_summary = profile["metrics"]["flood_risk"]
        sentence = baseline_sentence(
            region["name"],
            str(spec["label"]),
            metric_summary["change_percent"],
            metric_summary["period_mean"],
            metric_summary["baseline_mean"],
            str(spec["detail_unit"]),
            baseline_start,
            baseline_end,
        )
        peak_labels = []
        if season.get("available"):
            lookup = {item["month"]: item["label"] for item in season["months"]}
            peak_labels = [lookup[month] for month in season.get("peak_months", [])]
        steps = [
            {
                "id": "pattern",
                "title": "Where the signal sits",
                "insight": (
                    f"{region['name']} registers a {spec['label'].lower()} index of "
                    f"{_fmt(profile['risks'][hazard])} for {start}–{end}."
                ),
            },
            {
                "id": "trend",
                "title": "Long-term direction",
                "insight": f"{spec['label']} in {region['name']} {trend['trend']['description']}.",
            },
            {
                "id": "baseline",
                "title": "Against the historical baseline",
                "insight": sentence,
            },
            {
                "id": "seasonality",
                "title": "Seasonal concentration",
                "insight": (
                    f"The strongest months in this simulated series are {', '.join(peak_labels)}."
                    if peak_labels
                    else "Seasonal structure is unavailable for this selection."
                ),
            },
            {
                "id": "extremes",
                "title": "Unusual years in the simulation",
                "insight": (
                    f"{len(trend['events'])} simulated years reach the 95th percentile "
                    f"of {region['name']}'s own {spec['label'].lower()} series."
                ),
            },
            {
                "id": "related",
                "title": "Related hazard",
                "insight": association_phrase(correlation, str(spec["label"]).lower(), str(related_spec["label"]).lower()),
            },
        ]
        return {
            **self.origin,
            "available": True,
            "question": f"How is {spec['label'].lower()} changing in {region['name']}?",
            "region": region,
            "hazard": hazard,
            "steps": steps,
            "profile": profile,
            "trend": trend,
            "seasonality": season,
            "related_hazard": related,
            "correlation": _round(correlation, 2),
        }


def _round(value, digits: int):
    if value is None:
        return None
    return round(float(value), digits)


def _fmt(value) -> str:
    if value is None:
        return "no data"
    return f"{float(value):.0f}"


def _sample_warning(sample_size: int, baseline_start: int, baseline_end: int, series: dict, metric: str) -> str | None:
    if sample_size < 10:
        return "Small sample size — trend estimates are unstable."
    baseline = baseline_mean(list(range(YEAR_START, YEAR_END + 1)), series[metric], baseline_start, baseline_end, min_points=MIN_BASELINE_POINTS)
    if baseline is None:
        return "Historical baseline is incomplete for this selection."
    return None


def _trend_scale(hazard: str) -> float:
    """Slope (per year) that maps to a full 'rapid increase' score."""
    if hazard == "heat":
        return 0.06  # °C per year on the temperature anomaly source
    if hazard == "precipitation":
        return 8.0  # mm per year
    return 0.8  # index points per year


def _anomaly_score(hazard: str, delta: float | None) -> float:
    if delta is None:
        return 0.0
    if hazard == "heat":
        return max(0.0, min(100.0, float(delta) / 2.5 * 100))
    if hazard == "precipitation":
        return max(0.0, min(100.0, float(delta) / 250 * 100))
    return max(0.0, min(100.0, float(delta) / 30 * 100))

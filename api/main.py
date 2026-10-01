"""HTTP API for the Climate Risk Explorer.

Run from the repository root:
    uvicorn api.main:app --reload
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from api.service import ClimateStore
from climate_pipeline.schema import HAZARDS, OVERALL_WEIGHTS, ROLLING_WINDOW

store = ClimateStore()

app = FastAPI(
    title="Climate Risk Explorer",
    version="1.0.0",
    summary="Temperature from ERA5 via Our World in Data. Other hazards remain simulated.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


def _fail_region(code: str) -> HTTPException:
    return HTTPException(status_code=404, detail=f"NO DATA AVAILABLE for region {code}")


def _window(
    start: int,
    end: int,
    baseline_start: int,
    baseline_end: int,
) -> tuple[int, int, int, int]:
    first, last = store.years[0], store.years[-1]
    if start > end or baseline_start > baseline_end:
        raise HTTPException(status_code=400, detail="Period start must not exceed period end.")
    if start < first or end > last or baseline_start < first or baseline_end > last:
        raise HTTPException(status_code=400, detail=f"Years must fall between {first} and {last}.")
    return start, end, baseline_start, baseline_end


@app.get("/api/health")
def health():
    return {"status": "ok", **store.origin, "regions": len(store.regions)}


@app.get("/api/meta")
def meta():
    return {
        **store.origin,
        "years": store.years,
        "baseline": {
            "start": store.annual["meta"]["baseline_start"],
            "end": store.annual["meta"]["baseline_end"],
        },
        "hazards": HAZARDS,
        "weights": OVERALL_WEIGHTS,
        "rolling_window": ROLLING_WINDOW,
        "hot_day_threshold_c": store.annual["meta"].get("hot_day_threshold_c"),
    }


@app.get("/api/bootstrap")
def bootstrap():
    """Full annual series used by the interactive client."""
    return {**store.annual, "hazards": HAZARDS}


@app.get("/api/regions")
def regions():
    return {**store.origin, "regions": store.annual["regions"]}


@app.get("/api/hazards")
def hazards():
    return {**store.origin, "hazards": HAZARDS}


@app.get("/api/methodology")
def methodology():
    return {
        **store.origin,
        "indicators": [
            {
                "id": "temperature_anomaly",
                "name": "Temperature anomaly",
                "formula": "temperature(year, region) − mean temperature(region, baseline)",
                "baseline": "1980–2000 unless another window is selected",
                "unit": "°C",
            },
            {
                "id": "heat_days",
                "name": "Extreme heat days",
                "formula": "Sum over months of days × P(daily maximum > 30°C), with daily maxima modeled as normal around the monthly mean",
                "assumption": "Proxy only. February is 28 days. Not a station count.",
                "unit": "days",
            },
            {
                "id": "heat_risk",
                "name": "Heat risk index",
                "formula": "clip(100 × heat_days / 72, 0, 100)",
                "unit": "0–100",
            },
            {
                "id": "precipitation_anomaly",
                "name": "Precipitation anomaly",
                "formula": "annual precipitation − baseline mean precipitation",
                "unit": "mm",
            },
            {
                "id": "drought_index",
                "name": "Drought index",
                "formula": "clip(30 + 48 × ((1 − precip/climatology) × drought bias + 0.14 × temperature anomaly), 0, 100)",
                "assumption": "Not SPEI. Standardized around the 1980–2000 monthly climatology.",
                "unit": "0–100",
            },
            {
                "id": "precipitation_risk",
                "name": "Extreme precipitation index",
                "formula": "clip(100 × (peak monthly ratio − 1) / 1.2, 0, 100)",
                "unit": "0–100",
            },
            {
                "id": "wildfire_risk",
                "name": "Wildfire index",
                "formula": "fuel × (0.62 × summer drought + 0.38 × heat risk) × (0.55 + 0.45 × fuel)",
                "assumption": "Fuel is a scenario factor, not an observed fuel map.",
                "unit": "0–100",
            },
            {
                "id": "trend",
                "name": "Linear trend",
                "formula": "Ordinary least squares of the metric on year. Reported when at least 8 observations exist.",
                "uncertainty": "Shaded band is the 95% confidence interval of the mean response.",
            },
            {
                "id": "rolling",
                "name": "Rolling average",
                "formula": f"Trailing {ROLLING_WINDOW}-year mean. A window with a missing year is left empty.",
            },
            {
                "id": "overall",
                "name": "Combined risk",
                "formula": "0.24 heat + 0.20 drought + 0.16 flood + 0.14 precipitation + 0.16 wildfire + 0.10 storm",
                "assumption": "If any component is missing, the combined index is missing.",
            },
        ],
    }


@app.get("/api/risk/map")
def risk_map(
    hazard: str = "heat",
    year: int = 2025,
    mode: str = "absolute",
    baseline_start: int = 1980,
    baseline_end: int = 2000,
):
    if mode not in {"absolute", "anomaly"}:
        raise HTTPException(status_code=400, detail="mode must be absolute or anomaly")
    try:
        spec = store.require_hazard(hazard)
        values = store.map_values(hazard, year, mode, baseline_start, baseline_end)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Unknown hazard {hazard}") from None
    except KeyError:
        raise HTTPException(status_code=404, detail="NO DATA AVAILABLE for that year") from None
    return {
        **store.origin,
        "hazard": hazard,
        "year": year,
        "mode": mode,
        "metric": spec["absolute"] if mode == "absolute" else spec["anomaly_source"],
        "unit": "index" if mode == "absolute" else spec["anomaly_unit"],
        "legend": {
            "min": 0 if mode == "absolute" else spec["anomaly_min"],
            "max": 100 if mode == "absolute" else spec["anomaly_max"],
        },
        "baseline": {"start": baseline_start, "end": baseline_end},
        "values": values,
    }


@app.get("/api/risk/{region}")
def risk_region(
    region: str,
    start: int = 2005,
    end: int = 2025,
    baseline_start: int = 1980,
    baseline_end: int = 2000,
):
    start, end, baseline_start, baseline_end = _window(start, end, baseline_start, baseline_end)
    try:
        return store.profile(region, start, end, baseline_start, baseline_end)
    except KeyError:
        raise _fail_region(region) from None


@app.get("/api/trends/{region}/{hazard}")
def trends(
    region: str,
    hazard: str,
    start: int = 1980,
    end: int = 2025,
    baseline_start: int = 1980,
    baseline_end: int = 2000,
):
    start, end, baseline_start, baseline_end = _window(start, end, baseline_start, baseline_end)
    try:
        return store.trend(region, hazard, start, end, baseline_start, baseline_end)
    except KeyError:
        raise _fail_region(region) from None
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Unknown hazard {hazard}") from None


@app.get("/api/anomalies/{region}")
def anomalies(
    region: str,
    baseline_start: int = 1980,
    baseline_end: int = 2000,
):
    _window(store.years[0], store.years[-1], baseline_start, baseline_end)
    try:
        return store.anomalies(region, baseline_start, baseline_end)
    except KeyError:
        raise _fail_region(region) from None


@app.get("/api/seasonality/{region}/{hazard}")
def seasonality(
    region: str,
    hazard: str,
    start: int = 2005,
    end: int = 2025,
):
    start, end, _, _ = _window(start, end, 1980, 2000)
    try:
        return store.seasonality(region, hazard, start, end)
    except KeyError:
        raise _fail_region(region) from None
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Unknown hazard {hazard}") from None


@app.get("/api/events/{region}")
def events(region: str, hazard: str | None = None):
    try:
        if hazard:
            store.require_hazard(hazard)
        return {**store.origin, "region": region.upper(), "events": store.events(region, hazard)}
    except KeyError:
        raise _fail_region(region) from None
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Unknown hazard {hazard}") from None


@app.get("/api/hotspots")
def hotspots(
    year: int = 2025,
    hazard: str | None = None,
    limit: int = Query(default=8, ge=1, le=20),
    baseline_start: int = 1980,
    baseline_end: int = 2000,
):
    try:
        if hazard:
            store.require_hazard(hazard)
        return store.hotspots(year, hazard, limit, baseline_start, baseline_end)
    except KeyError:
        raise HTTPException(status_code=404, detail="NO DATA AVAILABLE for that year") from None
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Unknown hazard {hazard}") from None


@app.get("/api/compare")
def compare(
    regions: str,
    hazard: str = "heat",
    start: int = 1980,
    end: int = 2025,
    baseline_start: int = 1980,
    baseline_end: int = 2000,
):
    codes = [code.strip().upper() for code in regions.split(",") if code.strip()]
    start, end, baseline_start, baseline_end = _window(start, end, baseline_start, baseline_end)
    try:
        return store.compare(codes, hazard, start, end, baseline_start, baseline_end)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from None
    except KeyError as exc:
        raise _fail_region(str(exc).strip("'")) from None


@app.get("/api/investigation/{region}")
def investigation(
    region: str,
    hazard: str = "heat",
    start: int = 2005,
    end: int = 2025,
    baseline_start: int = 1980,
    baseline_end: int = 2000,
):
    start, end, baseline_start, baseline_end = _window(start, end, baseline_start, baseline_end)
    try:
        return store.investigation(region, hazard, start, end, baseline_start, baseline_end)
    except KeyError:
        raise _fail_region(region) from None
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Unknown hazard {hazard}") from None

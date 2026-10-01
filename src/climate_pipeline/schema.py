"""Dataset schema and hazard definitions.

The processed dataset is simulated. Field names describe the analytical
model, not an official climate archive.
"""

from __future__ import annotations

YEAR_START = 1980
YEAR_END = 2025
DEFAULT_BASELINE = (1980, 2000)
SEED = 42

# Trailing window used for the smooth climate signal.
ROLLING_WINDOW = 5

# Minimum observations required before a statistic is reported.
# Fewer points return null — they are never filled with zero.
MIN_BASELINE_POINTS = 5
MIN_TREND_POINTS = 8
MIN_PERCENTILE_POINTS = 8

RAW_COLUMNS = [
    "year",
    "month",
    "country_code",
    "country",
    "region",
    "latitude",
    "longitude",
    "temperature",
    "precipitation",
    "heat_days",
]

ANNUAL_METRICS = [
    "temperature",
    "precipitation",
    "heat_days",
    "drought_index",
    "flood_risk",
    "wildfire_risk",
    "storm_risk",
    "heat_risk",
    "drought_risk",
    "precipitation_risk",
    "overall_risk",
    "coverage",
]

# Absolute map layers use the 0–100 risk index.
# Anomaly map layers use the source metric minus the selected baseline mean.
HAZARDS: dict[str, dict[str, str | float]] = {
    "heat": {
        "label": "Extreme Heat",
        "short": "Heat",
        "absolute": "heat_risk",
        "detail": "heat_days",
        "detail_unit": "days",
        "anomaly_source": "temperature",
        "anomaly_unit": "°C",
        "anomaly_min": -2.5,
        "anomaly_max": 2.5,
        "description": "Estimated days with daily maximum temperature above 30°C.",
    },
    "drought": {
        "label": "Drought",
        "short": "Drought",
        "absolute": "drought_risk",
        "detail": "drought_index",
        "detail_unit": "index",
        "anomaly_source": "drought_index",
        "anomaly_unit": "index",
        "anomaly_min": -35,
        "anomaly_max": 35,
        "description": "Dryness proxy from precipitation deficit and temperature excess.",
    },
    "flood": {
        "label": "Flood",
        "short": "Flood",
        "absolute": "flood_risk",
        "detail": "flood_risk",
        "detail_unit": "index",
        "anomaly_source": "flood_risk",
        "anomaly_unit": "index",
        "anomaly_min": -40,
        "anomaly_max": 40,
        "description": "Exposure-weighted index of unusually wet months.",
    },
    "precipitation": {
        "label": "Extreme Precipitation",
        "short": "Precipitation",
        "absolute": "precipitation_risk",
        "detail": "precipitation",
        "detail_unit": "mm",
        "anomaly_source": "precipitation",
        "anomaly_unit": "mm",
        "anomaly_min": -500,
        "anomaly_max": 500,
        "description": "How far the wettest month exceeds its 1980–2000 climatology.",
    },
    "wildfire": {
        "label": "Wildfire",
        "short": "Wildfire",
        "absolute": "wildfire_risk",
        "detail": "wildfire_risk",
        "detail_unit": "index",
        "anomaly_source": "wildfire_risk",
        "anomaly_unit": "index",
        "anomaly_min": -40,
        "anomaly_max": 40,
        "description": "Overlap of heat, dryness, and a vegetation-fuel factor.",
    },
    "storm": {
        "label": "Storm / Wind",
        "short": "Storm",
        "absolute": "storm_risk",
        "detail": "storm_risk",
        "detail_unit": "index",
        "anomaly_source": "storm_risk",
        "anomaly_unit": "index",
        "anomaly_min": -40,
        "anomaly_max": 40,
        "description": "Storm-track exposure with mild simulated change over time.",
    },
}

# Fixed breakpoints for 0–100 visualization indices.
# heat_risk: 0 hot-days → 0, 72 hot-days → 100.
# The cap sits above a temperate summer so mid-latitude trends remain visible,
# while a very hot climate can still reach the top of the scale.
HEAT_DAYS_SATURATION = 72.0

# precipitation_risk: wettest month at 1.0× climatology → 0, at 2.2× → 100.
PRECIP_RATIO_LOW = 1.0
PRECIP_RATIO_HIGH = 2.2

OVERALL_WEIGHTS = {
    "heat_risk": 0.24,
    "drought_risk": 0.20,
    "flood_risk": 0.16,
    "precipitation_risk": 0.14,
    "wildfire_risk": 0.16,
    "storm_risk": 0.10,
}

# Hotspot score weights. They must sum to 1.
HOTSPOT_WEIGHTS = {
    "risk": 0.35,
    "anomaly": 0.25,
    "trend": 0.25,
    "concurrent": 0.15,
}

RELATED_HAZARD = {
    "heat": "drought",
    "drought": "heat",
    "flood": "precipitation",
    "precipitation": "flood",
    "wildfire": "drought",
    "storm": "flood",
}

MONTH_LABELS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

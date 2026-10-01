"""Seeded climate-like simulator.

Every series produced here is synthetic. Regional knobs (fuel, flood exposure,
warming rate) are scenario parameters, not fitted observations.

Heat days use a normal-tail proxy: daily maxima are assumed to be centered
above the monthly mean. Drought is a precipitation-deficit and temperature
excess index re-centered on the 1980–2000 climatology. It is not SPEI.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

from climate_pipeline.indicators import (
    estimated_hot_days,
    heat_risk_index,
    overall_risk_index,
    precipitation_risk_index,
)
from climate_pipeline.schema import MONTH_DAYS, SEED, YEAR_END, YEAR_START

YEARS = np.arange(YEAR_START, YEAR_END + 1)
N_YEARS = len(YEARS)
MONTHS = np.arange(1, 13)
BASELINE_SLICE = slice(0, 2000 - YEAR_START + 1)  # 1980–2000 inclusive

MEDITERRANEAN = {
    "ESP", "PRT", "ITA", "GRC", "MAR", "TUN", "DZA", "TUR", "HRV", "ALB",
    "CYP", "LBN", "ISR", "SYR", "MLT",
}


@dataclass
class RegionClimate:
    code: str
    name: str
    continent: str
    subregion: str
    latitude: float
    longitude: float
    zone: str
    t_mean: float
    t_amp: float
    warm_rate: float
    heat_offset: float
    heat_sigma: float
    precip: float
    precip_trend: float
    drought_bias: float
    flood_exposure: float
    fuel: float
    storm_exposure: float
    storm_trend: float


def _clip(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def default_zone(lat: float, code: str) -> str:
    if code in MEDITERRANEAN:
        return "mediterranean"
    magnitude = abs(lat)
    if magnitude < 12:
        return "tropical"
    if magnitude < 23:
        return "subtropical"
    if magnitude < 34:
        return "warm"
    if magnitude < 46:
        return "temperate"
    if magnitude < 62:
        return "boreal"
    return "polar"


def _zone_defaults(zone: str, lat: float) -> dict[str, float]:
    magnitude = abs(lat)
    # Rough annual-mean temperature and seasonal amplitude by zone.
    table: dict[str, dict[str, float]] = {
        "tropical": dict(t_mean=26.5, t_amp=1.8, precip=2100, heat_offset=5.2, heat_sigma=2.1, precip_trend=0.001, drought_bias=0.85, fuel=0.55, flood=0.55, storm=0.35),
        "subtropical": dict(t_mean=23.0, t_amp=5.5, precip=1100, heat_offset=6.0, heat_sigma=2.8, precip_trend=-0.001, drought_bias=1.0, fuel=0.4, flood=0.4, storm=0.4),
        "warm": dict(t_mean=19.5, t_amp=7.5, precip=800, heat_offset=6.4, heat_sigma=3.2, precip_trend=-0.0015, drought_bias=1.05, fuel=0.38, flood=0.32, storm=0.28),
        "mediterranean": dict(t_mean=15.2, t_amp=9.0, precip=640, heat_offset=5.2, heat_sigma=3.6, precip_trend=-0.0065, drought_bias=1.2, fuel=0.62, flood=0.28, storm=0.24),
        "temperate": dict(t_mean=10.0, t_amp=8.6, precip=820, heat_offset=6.4, heat_sigma=3.5, precip_trend=0.0015, drought_bias=0.95, fuel=0.34, flood=0.36, storm=0.42),
        "oceanic": dict(t_mean=9.4, t_amp=6.4, precip=1050, heat_offset=5.4, heat_sigma=3.0, precip_trend=0.002, drought_bias=0.8, fuel=0.18, flood=0.48, storm=0.62),
        "continental": dict(t_mean=7.4, t_amp=12.5, precip=620, heat_offset=7.6, heat_sigma=4.2, precip_trend=0.001, drought_bias=1.0, fuel=0.3, flood=0.3, storm=0.28),
        "boreal": dict(t_mean=1.8, t_amp=12.0, precip=620, heat_offset=6.2, heat_sigma=3.8, precip_trend=0.004, drought_bias=0.75, fuel=0.42, flood=0.22, storm=0.3),
        "arid": dict(t_mean=22.0, t_amp=9.0, precip=140, heat_offset=8.5, heat_sigma=3.4, precip_trend=-0.002, drought_bias=1.15, fuel=0.08, flood=0.12, storm=0.12),
        "polar": dict(t_mean=-8.0, t_amp=10.0, precip=320, heat_offset=4.0, heat_sigma=3.2, precip_trend=0.003, drought_bias=0.5, fuel=0.04, flood=0.1, storm=0.22),
    }
    params = dict(table[zone])
    # High latitudes warm faster. This is an imposed scenario factor.
    params["warm_rate"] = 0.034 * (1 + max(0.0, magnitude - 35) / 70)
    if magnitude > 65:
        params["warm_rate"] += 0.012
    params["storm_trend"] = 0.08 * params["storm"]
    return params


# Scenario overrides for territories the interface is expected to tell apart.
# Numbers are simulator settings, not published climate normals.
OVERRIDES: dict[str, dict[str, float | str]] = {
    "ESP": dict(zone="mediterranean", t_mean=14.2, t_amp=9.3, precip=560, warm_rate=0.048, drought_bias=1.55, fuel=0.82, flood_exposure=0.26, storm_exposure=0.18, heat_offset=4.9, heat_sigma=3.6, precip_trend=-0.009),
    "PRT": dict(zone="mediterranean", t_mean=15.2, t_amp=7.2, precip=800, warm_rate=0.04, drought_bias=1.3, fuel=0.72, flood_exposure=0.24, storm_exposure=0.28, heat_offset=5.0, precip_trend=-0.007),
    "FRA": dict(zone="temperate", t_mean=11.4, t_amp=8.6, precip=840, warm_rate=0.04, drought_bias=1.2, fuel=0.42, flood_exposure=0.4, storm_exposure=0.5, heat_offset=6.2, heat_sigma=3.5, precip_trend=-0.0025),
    "DEU": dict(zone="temperate", t_mean=9.2, t_amp=9.2, precip=740, warm_rate=0.032, fuel=0.3, flood_exposure=0.42, storm_exposure=0.4),
    "ITA": dict(zone="mediterranean", t_mean=13.8, t_amp=9.4, precip=780, warm_rate=0.033, drought_bias=1.2, fuel=0.66, flood_exposure=0.32, precip_trend=-0.0055),
    "MAR": dict(zone="mediterranean", t_mean=17.2, t_amp=7.6, precip=320, warm_rate=0.044, drought_bias=1.65, fuel=0.34, flood_exposure=0.18, storm_exposure=0.16, heat_offset=5.4, precip_trend=-0.008),
    "GBR": dict(zone="oceanic", t_mean=9.1, t_amp=6.2, precip=1180, warm_rate=0.026, fuel=0.14, flood_exposure=0.5, storm_exposure=0.74, drought_bias=0.7),
    "SWE": dict(zone="boreal", t_mean=3.0, t_amp=11.5, precip=680, warm_rate=0.04, fuel=0.46, flood_exposure=0.2, storm_exposure=0.26, heat_offset=5.8, heat_sigma=3.6),
    "NOR": dict(zone="boreal", t_mean=2.2, t_amp=9.0, precip=1250, warm_rate=0.038, fuel=0.28, flood_exposure=0.26, storm_exposure=0.58, heat_offset=5.2),
    "POL": dict(zone="continental", t_mean=8.1, t_amp=11.2, precip=600, warm_rate=0.033, fuel=0.26, flood_exposure=0.34, storm_exposure=0.24),
    "GRC": dict(zone="mediterranean", t_mean=16.2, t_amp=8.6, precip=500, warm_rate=0.046, drought_bias=1.5, fuel=0.86, flood_exposure=0.22, precip_trend=-0.008, heat_offset=5.6),
    "NLD": dict(zone="oceanic", t_mean=10.1, t_amp=7.0, precip=820, warm_rate=0.029, fuel=0.1, flood_exposure=0.92, storm_exposure=0.68, drought_bias=0.65),
    "USA": dict(t_mean=11.5, t_amp=10.5, precip=780, warm_rate=0.03, fuel=0.48, flood_exposure=0.4, storm_exposure=0.48),
    "AUS": dict(zone="subtropical", t_mean=21.6, t_amp=6.5, precip=480, warm_rate=0.03, drought_bias=1.25, fuel=0.74, flood_exposure=0.28, storm_exposure=0.32, precip_trend=-0.003),
    "IND": dict(zone="tropical", t_mean=24.2, t_amp=6.8, precip=1150, warm_rate=0.025, fuel=0.42, flood_exposure=0.78, storm_exposure=0.5, heat_offset=6.4, heat_sigma=2.4),
    "CHN": dict(t_mean=8.5, t_amp=13.0, precip=640, warm_rate=0.032, fuel=0.36, flood_exposure=0.48, storm_exposure=0.36),
    "BRA": dict(zone="tropical", t_mean=24.8, t_amp=2.2, precip=1760, fuel=0.58, flood_exposure=0.5, storm_exposure=0.22),
    "BGD": dict(zone="tropical", precip=2400, flood_exposure=0.96, storm_exposure=0.72, fuel=0.3, heat_offset=5.5),
    "PHL": dict(zone="tropical", precip=2500, flood_exposure=0.7, storm_exposure=0.88, fuel=0.4),
    "JPN": dict(precip=1680, storm_exposure=0.66, flood_exposure=0.55, fuel=0.36, t_mean=12.5, t_amp=10.0),
    "EGY": dict(zone="arid", t_mean=22.4, precip=40, fuel=0.05, flood_exposure=0.08, drought_bias=0.9, heat_offset=8.0),
    "SAU": dict(zone="arid", t_mean=24.5, precip=70, fuel=0.04, heat_offset=8.8, heat_sigma=3.2),
    "NGA": dict(zone="tropical", precip=1400, fuel=0.5, flood_exposure=0.55),
    "ZAF": dict(zone="subtropical", t_mean=17.5, precip=460, drought_bias=1.15, fuel=0.45, warm_rate=0.028),
    "RUS": dict(zone="continental", t_mean=-1.5, t_amp=16.0, warm_rate=0.046, precip=480, fuel=0.4, heat_offset=7.0),
    "CAN": dict(zone="boreal", t_mean=-1.0, t_amp=15.0, warm_rate=0.044, precip=520, fuel=0.46),
    "GRL": dict(zone="polar", t_mean=-14.0, t_amp=12.0, warm_rate=0.06, precip=350, fuel=0.02, heat_offset=3.5),
    "MEX": dict(zone="subtropical", t_mean=20.5, precip=760, fuel=0.4, drought_bias=1.1, heat_offset=6.2),
    "IDN": dict(zone="tropical", precip=2700, flood_exposure=0.62, storm_exposure=0.3, fuel=0.5),
    "ARG": dict(t_mean=14.5, t_amp=7.0, precip=580, fuel=0.36, warm_rate=0.024),
}


def build_region_climate(feature: dict) -> RegionClimate | None:
    props = feature["properties"]
    code = props.get("ADM0_A3")
    if not code or code == "-99":
        return None
    point = representative_lonlat(feature["geometry"])
    if point is None:
        return None
    lon, lat = point
    override = OVERRIDES.get(code, {})
    zone = str(override.get("zone") or default_zone(lat, code))
    defaults = _zone_defaults(zone, lat)
    merged = {**defaults, **{key: value for key, value in override.items() if key != "zone"}}
    return RegionClimate(
        code=code,
        name=props.get("NAME") or props.get("ADMIN") or code,
        continent=props.get("CONTINENT") or "Unknown",
        subregion=props.get("SUBREGION") or "",
        latitude=round(lat, 3),
        longitude=round(lon, 3),
        zone=zone,
        t_mean=float(merged["t_mean"]),
        t_amp=float(merged["t_amp"]),
        warm_rate=float(merged["warm_rate"]),
        heat_offset=float(merged["heat_offset"]),
        heat_sigma=float(merged["heat_sigma"]),
        precip=float(merged["precip"]),
        precip_trend=float(merged["precip_trend"]),
        drought_bias=float(merged["drought_bias"]),
        flood_exposure=float(merged.get("flood_exposure", merged.get("flood", 0.3))),
        fuel=float(merged["fuel"]),
        storm_exposure=float(merged.get("storm_exposure", merged.get("storm", 0.3))),
        storm_trend=float(merged.get("storm_trend", 0.05)),
    )


def representative_lonlat(geometry: dict) -> tuple[float, float] | None:
    """Centroid of the largest ring, robust to dateline spans."""
    if geometry["type"] == "Polygon":
        rings = [geometry["coordinates"][0]]
    elif geometry["type"] == "MultiPolygon":
        rings = [poly[0] for poly in geometry["coordinates"] if poly]
    else:
        return None
    best: tuple[float, float] | None = None
    best_area = -1.0
    for ring in rings:
        if len(ring) < 4:
            continue
        xs = [float(coord[0]) for coord in ring]
        ys = [float(coord[1]) for coord in ring]
        if max(xs) - min(xs) > 180:
            xs = [(x + 360 if x < 0 else x) for x in xs]
            lon = sum(xs) / len(xs)
            if lon > 180:
                lon -= 360
            span = max(xs) - min(xs)
        else:
            lon = sum(xs) / len(xs)
            span = max(xs) - min(xs)
        lat = sum(ys) / len(ys)
        area = span * (max(ys) - min(ys))
        if area > best_area:
            best_area = area
            best = (lon, lat)
    return best


def _ar1(length: int, phi: float, sigma: float, rng: np.random.Generator) -> np.ndarray:
    shocks = rng.normal(0.0, sigma, size=length)
    series = np.empty(length)
    series[0] = shocks[0]
    for index in range(1, length):
        series[index] = phi * series[index - 1] + shocks[index]
    return series


def _month_weights(zone: str, lat: float) -> np.ndarray:
    peak = 1 if lat >= 0 else 7
    summer = 7 if lat >= 0 else 1
    months = MONTHS.astype(float)
    if zone == "mediterranean":
        weights = 0.45 + 0.55 * np.cos(2 * np.pi * (months - peak) / 12)
    elif zone in {"tropical", "subtropical"}:
        weights = 0.65 + 0.55 * np.cos(2 * np.pi * (months - summer) / 12)
    elif zone == "arid":
        weights = np.ones(12)
    elif zone == "oceanic":
        weights = 0.85 + 0.25 * np.cos(2 * np.pi * (months - peak) / 12)
    else:
        weights = 0.8 + 0.35 * np.cos(2 * np.pi * (months - summer) / 12)
    weights = np.clip(weights, 0.08, None)
    return weights / weights.sum()


def _missing_year(code: str, year: int) -> bool:
    """Intentional gaps so the product can show incomplete coverage.

    Greenland drops every 7th year. South Sudan, when present in the
    boundary file, has no simulated record before 1991. Gaps stay null.
    """
    if code == "GRL" and year % 7 == 0:
        return True
    if code in {"SSD", "SDS"} and year < 1991:
        return True
    return False


def _country_rng(code: str) -> np.random.Generator:
    salt = sum((index + 1) * ord(char) for index, char in enumerate(code))
    return np.random.default_rng((SEED + salt * 997) % (2**32))


def simulate_country(
    region: RegionClimate,
    global_mode: np.ndarray,
    regional_mode: np.ndarray,
) -> dict:
    rng = _country_rng(region.code)
    annual_noise = _ar1(N_YEARS, 0.4, 0.16, rng)
    month_noise = rng.normal(0.0, 0.28, size=(N_YEARS, 12))
    storm_noise = _ar1(N_YEARS, 0.35, 4.5, rng)

    year_grid = YEARS[:, None]
    month_grid = MONTHS[None, :]
    peak = 7 if region.latitude >= 0 else 1
    seasonal = region.t_amp * np.cos(2 * np.pi * (month_grid - peak) / 12.0)
    warming = (year_grid - 1990) * region.warm_rate
    if region.zone == "mediterranean":
        summer_months = [6, 7, 8] if region.latitude >= 0 else [12, 1, 2]
        summer = np.isin(MONTHS, summer_months)
        warming = warming * np.where(summer, 1.7, 0.82)

    temperature = (
        region.t_mean
        + seasonal
        + warming
        + 0.55 * regional_mode[:, None]
        + 0.35 * global_mode[:, None]
        + annual_noise[:, None]
        + month_noise
    )

    weights = _month_weights(region.zone, region.latitude)
    relative = np.maximum(0.4, 1 + (year_grid - 1990) * region.precip_trend)
    precip_noise = np.exp(rng.normal(0.0, 0.07, size=(N_YEARS, 1)))
    precip = region.precip * relative * precip_noise * weights[None, :]
    # Occasional wet-month spike, more likely in already wet months.
    spike_draw = rng.random((N_YEARS, 12))
    spike_chance = 0.045 + 0.12 * weights
    spike = spike_draw < spike_chance[None, :]
    spike_size = rng.uniform(1.35, 2.05, size=(N_YEARS, 12))
    precip = precip * np.where(spike, spike_size, 1.0)
    precip = np.maximum(precip, 0.0)

    heat_days = np.zeros_like(temperature)
    for month_index, month_days in enumerate(MONTH_DAYS):
        for year_index in range(N_YEARS):
            heat_days[year_index, month_index] = estimated_hot_days(
                float(temperature[year_index, month_index]),
                month_days,
                region.heat_offset,
                region.heat_sigma,
            )

    baseline_temp = temperature[BASELINE_SLICE].mean(axis=0)
    baseline_precip = precip[BASELINE_SLICE].mean(axis=0)
    baseline_precip = np.maximum(baseline_precip, 0.5)

    ratio = precip / baseline_precip
    temp_anomaly_month = temperature - baseline_temp
    dry_signal = (1.0 - ratio) * region.drought_bias + 0.14 * temp_anomaly_month
    drought_month = np.clip(30.0 + dry_signal * 48.0, 0.0, 100.0)

    peak_ratio = (precip / baseline_precip).max(axis=1)
    annual_temp = temperature.mean(axis=1)
    annual_precip = precip.sum(axis=1)
    annual_heat = heat_days.sum(axis=1)
    annual_drought = drought_month.mean(axis=1)

    summer = [5, 6, 7] if region.latitude >= 0 else [11, 0, 1]
    summer_drought = drought_month[:, summer].mean(axis=1)
    heat_risk = np.array([heat_risk_index(value) for value in annual_heat], dtype=float)
    drought_risk = annual_drought.copy()
    precip_risk = np.array([precipitation_risk_index(value) for value in peak_ratio], dtype=float)

    wet_peak = np.maximum(0.0, peak_ratio - 1.0)
    flood = np.clip(
        100.0 * (0.62 * region.flood_exposure * np.clip(annual_precip / max(region.precip, 1), 0, 1.4) / 1.4
        + 0.38 * np.clip(wet_peak / 1.1, 0, 1)),
        0,
        100,
    )
    # Keep a floor so high-exposure coasts remain visible even in a drier year.
    flood = np.clip(flood * 0.72 + region.flood_exposure * 28.0, 0, 100)

    wildfire = np.clip(
        region.fuel
        * (0.62 * summer_drought + 0.38 * heat_risk)
        * (0.55 + 0.45 * region.fuel),
        0,
        100,
    )

    storm = np.clip(
        12.0
        + region.storm_exposure * 74.0
        + (YEARS - 1990) * region.storm_trend
        + storm_noise,
        0,
        100,
    )

    overall = []
    coverage = []
    for index, year in enumerate(YEARS):
        if _missing_year(region.code, int(year)):
            coverage.append(0.0)
            overall.append(np.nan)
            annual_temp[index] = np.nan
            annual_precip[index] = np.nan
            annual_heat[index] = np.nan
            annual_drought[index] = np.nan
            heat_risk[index] = np.nan
            drought_risk[index] = np.nan
            precip_risk[index] = np.nan
            flood[index] = np.nan
            wildfire[index] = np.nan
            storm[index] = np.nan
            temperature[index, :] = np.nan
            precip[index, :] = np.nan
            heat_days[index, :] = np.nan
            drought_month[index, :] = np.nan
            continue
        coverage.append(1.0)
        overall.append(
            overall_risk_index(
                {
                    "heat_risk": heat_risk[index],
                    "drought_risk": drought_risk[index],
                    "flood_risk": flood[index],
                    "precipitation_risk": precip_risk[index],
                    "wildfire_risk": wildfire[index],
                    "storm_risk": storm[index],
                }
            )
        )

    def pack(values: np.ndarray) -> list[float | None]:
        packed: list[float | None] = []
        for value in values.tolist():
            if value is None or (isinstance(value, float) and math.isnan(value)):
                packed.append(None)
            else:
                packed.append(round(float(value), 2))
        return packed

    return {
        "region": {
            "code": region.code,
            "name": region.name,
            "continent": region.continent,
            "subregion": region.subregion,
            "latitude": region.latitude,
            "longitude": region.longitude,
            "zone": region.zone,
        },
        "annual": {
            "temperature": pack(annual_temp),
            "precipitation": pack(annual_precip),
            "heat_days": pack(annual_heat),
            "drought_index": pack(annual_drought),
            "flood_risk": pack(flood),
            "wildfire_risk": pack(wildfire),
            "storm_risk": pack(storm),
            "heat_risk": pack(heat_risk),
            "drought_risk": pack(drought_risk),
            "precipitation_risk": pack(precip_risk),
            "overall_risk": pack(np.array(overall, dtype=float)),
            "coverage": pack(np.array(coverage, dtype=float)),
        },
        "monthly": {
            "temperature": [pack(row) for row in temperature],
            "precipitation": [pack(row) for row in precip],
            "heat_days": [pack(row) for row in heat_days],
            "drought_index": [pack(row) for row in drought_month],
        },
    }


def shared_modes(regions: list[RegionClimate]) -> tuple[np.ndarray, dict[str, np.ndarray]]:
    rng = np.random.default_rng(SEED)
    global_mode = _ar1(N_YEARS, 0.5, 0.22, rng)
    continents = sorted({region.continent for region in regions})
    regional = {name: _ar1(N_YEARS, 0.48, 0.2, rng) for name in continents}
    return global_mode, regional


def simulate_world(features: list[dict]) -> tuple[dict, dict, list[dict]]:
    regions = []
    for feature in features:
        region = build_region_climate(feature)
        if region is not None:
            regions.append(region)
    regions.sort(key=lambda item: item.code)
    global_mode, regional_modes = shared_modes(regions)

    annual_series: dict[str, dict] = {}
    monthly_series: dict[str, dict] = {}
    region_meta = []
    raw_rows: list[dict] = []

    for region in regions:
        simulated = simulate_country(region, global_mode, regional_modes[region.continent])
        annual_series[region.code] = simulated["annual"]
        monthly_series[region.code] = simulated["monthly"]
        region_meta.append(simulated["region"])
        for year_index, year in enumerate(YEARS):
            for month_index in range(12):
                raw_rows.append(
                    {
                        "year": int(year),
                        "month": month_index + 1,
                        "country_code": region.code,
                        "country": region.name,
                        "region": region.continent,
                        "latitude": region.latitude,
                        "longitude": region.longitude,
                        "temperature": simulated["monthly"]["temperature"][year_index][month_index],
                        "precipitation": simulated["monthly"]["precipitation"][year_index][month_index],
                        "heat_days": simulated["monthly"]["heat_days"][year_index][month_index],
                    }
                )

    annual_payload = {
        "meta": {
            "data_origin": "simulated",
            "label": "DEMO / SIMULATED DATA",
            "seed": SEED,
            "year_start": YEAR_START,
            "year_end": YEAR_END,
            "baseline_start": 1980,
            "baseline_end": 2000,
            "hot_day_threshold_c": 30.0,
            "notes": [
                "All values are synthetic and produced with a fixed random seed.",
                "They are not measurements from Copernicus, ERA5, NOAA, NASA, or national services.",
                "Extreme heat days are a normal-tail proxy for daily maxima above 30°C, not station counts.",
                "The drought index is a precipitation-and-temperature deficit proxy centered on 1980–2000, not SPEI.",
                "Flood, wildfire, and storm values are exposure-weighted indices on a 0–100 scale.",
                "Greenland drops every year divisible by 7 so missing data stays missing.",
            ],
        },
        "years": [int(year) for year in YEARS],
        "regions": region_meta,
        "series": annual_series,
    }
    monthly_payload = {
        "meta": annual_payload["meta"],
        "years": annual_payload["years"],
        "regions": monthly_series,
    }
    return annual_payload, monthly_payload, raw_rows

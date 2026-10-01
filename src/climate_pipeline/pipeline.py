"""Run the simulated climate pipeline from geography to processed files."""

from __future__ import annotations

import csv
import json
from pathlib import Path

from climate_pipeline.generate import simulate_world
from climate_pipeline.observations import apply_observed_temperatures
from climate_pipeline.validation import assert_valid, validate_processed, validate_raw_rows

ROOT = Path(__file__).resolve().parents[2]
GEO_SOURCE = ROOT / "data" / "geographic" / "ne_110m_admin_0_countries.json"
RAW_CSV = ROOT / "data" / "raw" / "climate_monthly.csv"
ANNUAL_PATH = ROOT / "data" / "processed" / "climate.json"
MONTHLY_PATH = ROOT / "data" / "processed" / "monthly.json"
FRONTEND_GEO = ROOT / "frontend" / "public" / "geo" / "countries.json"

REQUIRED = ["FRA", "ESP", "PRT", "DEU", "ITA", "MAR", "GBR", "SWE", "NOR", "POL", "GRC", "NLD"]


def slim_geojson(features: list[dict], codes: set[str]) -> dict:
    slim = []
    for feature in features:
        code = feature["properties"].get("ADM0_A3")
        if code not in codes:
            continue
        slim.append(
            {
                "type": "Feature",
                "properties": {
                    "iso": code,
                    "name": feature["properties"].get("NAME") or code,
                    "continent": feature["properties"].get("CONTINENT") or "",
                },
                "geometry": feature["geometry"],
            }
        )
    return {"type": "FeatureCollection", "features": slim}


def write_raw_csv(rows: list[dict], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
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
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def run() -> dict:
    geography = json.loads(GEO_SOURCE.read_text(encoding="utf-8"))
    annual, monthly, raw_rows = simulate_world(geography["features"])
    temperature = apply_observed_temperatures(annual, monthly, raw_rows)
    annual["meta"]["temperature_coverage"] = {
        "matched_regions": temperature["matched"],
        "regions_without_temperature": temperature["missing"],
    }
    raw_errors = validate_raw_rows(raw_rows)
    processed_errors = validate_processed(annual, REQUIRED)
    assert_valid(raw_errors + processed_errors)

    write_raw_csv(raw_rows, RAW_CSV)
    ANNUAL_PATH.parent.mkdir(parents=True, exist_ok=True)
    ANNUAL_PATH.write_text(json.dumps(annual), encoding="utf-8")
    MONTHLY_PATH.write_text(json.dumps(monthly), encoding="utf-8")

    codes = {region["code"] for region in annual["regions"]}
    FRONTEND_GEO.parent.mkdir(parents=True, exist_ok=True)
    FRONTEND_GEO.write_text(json.dumps(slim_geojson(geography["features"], codes)), encoding="utf-8")
    return annual


if __name__ == "__main__":
    payload = run()
    print(f"regions={len(payload['regions'])} years={len(payload['years'])}")

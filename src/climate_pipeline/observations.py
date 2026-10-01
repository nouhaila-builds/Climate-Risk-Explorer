"""Replace simulated temperature with observed country means.

Source: Our World in Data, "Average monthly surface temperature".
The values are ERA5 2 m temperature aggregated by country. The file used
here runs from 1940 through August 2026. Only complete years inside the
app window, 1980–2025, are written.

Heat days, drought, flood, precipitation, wildfire and storm stay simulated.
They are not recomputed from this temperature.
"""

from __future__ import annotations

import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OWID_PATH = ROOT / "data" / "raw" / "owid" / "average-monthly-surface-temperature.csv"

SOURCE_NOTE = (
    "Monthly temperature is ERA5 2 m temperature aggregated by country by Our World in Data. "
    "Contains modified Copernicus Climate Change Service information (2026)."
)


def load_monthly_means(path: Path = OWID_PATH) -> dict[str, dict[tuple[int, int], float]]:
    """ISO3 code → (year, month) → °C. Non-country rows are ignored."""
    table: dict[str, dict[tuple[int, int], float]] = {}
    with path.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            code = (row.get("Code") or "").strip()
            if len(code) != 3 or not code.isalpha():
                continue
            month_text = (row.get("Month") or "").strip()
            raw = (row.get("Monthly average") or "").strip()
            if len(month_text) < 7 or not raw:
                continue
            year_text, month = month_text[:4], month_text[5:7]
            if not year_text.isdigit() or not month.isdigit():
                continue
            table.setdefault(code, {})[(int(year_text), int(month))] = float(raw)
    return table


def apply_observed_temperatures(annual: dict, monthly: dict, raw_rows: list[dict], path: Path = OWID_PATH) -> dict:
    """Overwrite temperature fields. Countries missing from the file become null."""
    observed = load_monthly_means(path)
    years: list[int] = annual["years"]
    matched = 0
    missing_codes: list[str] = []

    for code, series in annual["series"].items():
        months = observed.get(code)
        annual_means: list[float | None] = []
        monthly_rows: list[list[float | None]] = []
        if months is None:
            missing_codes.append(code)
        else:
            matched += 1
        for year in years:
            year_months: list[float | None] = []
            complete = months is not None
            for month in range(1, 13):
                value = None if months is None else months.get((year, month))
                if value is None:
                    complete = False
                    year_months.append(None)
                else:
                    year_months.append(round(value, 2))
            monthly_rows.append(year_months)
            if complete:
                present = [value for value in year_months if value is not None]
                annual_means.append(round(sum(present) / 12, 2))
            else:
                annual_means.append(None)
        series["temperature"] = annual_means
        record = monthly["regions"].get(code)
        if record is not None:
            record["temperature"] = monthly_rows

    for row in raw_rows:
        months = observed.get(row["country_code"])
        value = None if months is None else months.get((int(row["year"]), int(row["month"])))
        row["temperature"] = None if value is None else round(value, 2)

    notes = [
        SOURCE_NOTE,
        "The app keeps annual means for 1980–2025. A year is stored only when all twelve months are present.",
        "A country absent from the file has a null temperature. It is not replaced with the simulation or with zero.",
        "Extreme heat days, drought, precipitation, flood, wildfire and storm remain a seeded simulation.",
        "Those hazard indices are not derived from the observed temperature.",
        "Greenland's intentional gaps still apply to the simulated hazard indices.",
    ]
    annual["meta"]["data_origin"] = "mixed"
    annual["meta"]["label"] = "TEMPERATURE · ERA5 / OWID · OTHER HAZARDS · SIMULATED"
    annual["meta"]["temperature_source"] = "Our World in Data, ERA5 2 m temperature"
    annual["meta"]["notes"] = notes
    return {"matched": matched, "missing": len(missing_codes), "missing_codes": missing_codes}

"""Download ERA5 monthly 2 m temperature, 1980–2025.

The request copied from the Copernicus form selects every product, every
variable and every hour from 1940 onward. That is hundreds of gigabytes and
is not what the explorer needs.

This script asks only for the monthly mean of 2 m temperature on a 1° grid.
A Copernicus account and a personal access token are required.

Create %USERPROFILE%\\.cdsapirc with:

    url: https://cds.climate.copernicus.eu/api
    key: YOUR_PERSONAL_ACCESS_TOKEN

The token is created at https://cds.climate.copernicus.eu/profile
"""

from __future__ import annotations

from pathlib import Path

import cdsapi

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "data" / "raw" / "era5" / "era5_t2m_monthly_1980_2025.nc"

DATASET = "reanalysis-era5-single-levels-monthly-means"
REQUEST = {
    "product_type": ["monthly_averaged_reanalysis"],
    "variable": ["2m_temperature"],
    "year": [str(year) for year in range(1980, 2026)],
    "month": [f"{month:02d}" for month in range(1, 13)],
    "time": ["00:00"],
    "grid": [1.0, 1.0],
    "data_format": "netcdf",
    "download_format": "unarchived",
}


def main() -> None:
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    cdsapi.Client().retrieve(DATASET, REQUEST).download(str(TARGET))
    print(f"Wrote {TARGET}")


if __name__ == "__main__":
    main()

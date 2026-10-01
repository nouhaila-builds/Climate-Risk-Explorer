"""Generate the seeded demo climate dataset.

Usage (from the repository root):
    python generate_climate_data.py
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "src"))

from climate_pipeline.pipeline import run  # noqa: E402


if __name__ == "__main__":
    payload = run()
    print(f"Wrote climate data for {len(payload['regions'])} regions.")
    print(f"Label: {payload['meta']['label']}")

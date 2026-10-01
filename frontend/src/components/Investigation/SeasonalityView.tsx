import { arc } from "d3-shape";
import { HAZARD_MAP } from "../../encoding";
import { formatNumber } from "../../format";
import type { HazardId } from "../../types";

interface MonthValue {
  month: number;
  label: string;
  value: number | null;
}

export function SeasonalityView({ hazard, months }: { hazard: HazardId; months: MonthValue[] | null }) {
  const spec = HAZARD_MAP[hazard];
  if (!months || months.every((month) => month.value === null)) {
    return <p className="empty-state">NO DATA AVAILABLE for the seasonal view.</p>;
  }
  const max = Math.max(...months.map((month) => month.value ?? 0), 1);
  const generator = arc<{ startAngle: number; endAngle: number; outer: number }>()
    .innerRadius(42)
    .outerRadius((datum) => datum.outer)
    .startAngle((datum) => datum.startAngle)
    .endAngle((datum) => datum.endAngle);
  return (
    <div>
      <p className="kicker">{spec.label} by month · simulated</p>
      <svg className="season" viewBox="0 0 280 280" role="img" aria-label="Seasonal pattern">
        <g transform="translate(140,140)">
          {months.map((month, index) => {
            const start = (index / 12) * Math.PI * 2 - Math.PI / 2;
            const outer = 48 + ((month.value ?? 0) / max) * 72;
            return (
              <g key={month.month}>
                <path
                  d={generator({ startAngle: start, endAngle: start + (Math.PI * 2) / 12 - 0.04, outer }) ?? ""}
                  fill={month.value === null ? "#1c2c34" : spec.stops[1]}
                  opacity={month.value === null ? 1 : 0.35 + 0.65 * ((month.value ?? 0) / max)}
                >
                  <title>{month.value === null ? `${month.label}: NO DATA` : `${month.label}: ${formatNumber(month.value, 1)}`}</title>
                </path>
                <text
                  transform={`rotate(${(index + 0.5) * 30 - 90}) translate(128,0)`}
                  fill="#91A4AE"
                  fontSize="9"
                  textAnchor="middle"
                  fontFamily="IBM Plex Mono, monospace"
                >
                  {month.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

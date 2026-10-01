import { HAZARD_MAP } from "../../encoding";
import { formatNumber, formatPercent } from "../../format";
import type { HazardId } from "../../types";

interface BaselineComparisonProps {
  hazard: HazardId;
  baselineLabel: string;
  recentLabel: string;
  baseline: number | null;
  recent: number | null;
  change: number | null;
}

export function BaselineComparison({ hazard, baselineLabel, recentLabel, baseline, recent, change }: BaselineComparisonProps) {
  const spec = HAZARD_MAP[hazard];
  const max = Math.max(baseline ?? 0, recent ?? 0, 1);
  const height = (value: number | null) => `${value === null ? 8 : Math.max(8, (value / max) * 88)}px`;
  if (baseline === null || recent === null) {
    return <p className="empty-state">NO DATA AVAILABLE for this baseline comparison.</p>;
  }
  return (
    <div>
      <p className="kicker">{spec.label} · {spec.detailUnit} / year</p>
      <div className="slope">
        <div>
          <p className="kicker">Baseline {baselineLabel}</p>
          <div className="value">{formatNumber(baseline, 1)}</div>
          <div style={{ height: height(baseline), width: 8, background: "#8FA0A8", marginTop: 8 }} />
        </div>
        <svg viewBox="0 0 120 80" aria-hidden="true">
          <line x1="8" y1={70 - (baseline / max) * 60} x2="112" y2={70 - (recent / max) * 60} stroke="#E6C98A" strokeWidth="1.5" />
        </svg>
        <div>
          <p className="kicker">Recent {recentLabel}</p>
          <div className="value">{formatNumber(recent, 1)}</div>
          <div style={{ height: height(recent), width: 8, background: spec.stops[1], marginTop: 8 }} />
        </div>
        <div className="delta">{formatPercent(change)}</div>
      </div>
    </div>
  );
}

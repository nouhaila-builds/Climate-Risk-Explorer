import { buildProfile, mapReading } from "../../analytics";
import { useClimateData } from "../../data/ClimateData";
import { HAZARD_MAP } from "../../encoding";
import { formatNumber, formatSigned } from "../../format";
import { directionWord } from "../../insights";
import { useHoverStore } from "../../hoverStore";
import { linearTrend } from "../../stats";
import { useExplorerStore } from "../../store";

export function MapTooltip() {
  const { dataset } = useClimateData();
  const code = useHoverStore((state) => state.code);
  const x = useHoverStore((state) => state.x);
  const y = useHoverStore((state) => state.y);
  const hazard = useExplorerStore((state) => state.hazard);
  const year = useExplorerStore((state) => state.year);
  const mode = useExplorerStore((state) => state.mode);
  const start = useExplorerStore((state) => state.start);
  const end = useExplorerStore((state) => state.end);
  const b0 = useExplorerStore((state) => state.b0);
  const b1 = useExplorerStore((state) => state.b1);
  const view = useExplorerStore((state) => state.view);
  if (!dataset || !code || view === "/compare") return null;
  const region = dataset.regions.find((item) => item.code === code);
  const series = dataset.series[code];
  if (!region || !series) return null;
  const spec = HAZARD_MAP[hazard];
  const reading = mapReading(series, dataset.years, hazard, year, mode, b0, b1);
  const profile = buildProfile(dataset, code, hazard, year, start, end, b0, b1);
  const trend = linearTrend(dataset.years, series[spec.detail]);
  const direction = directionWord(trend.slope, trend.stderr);
  const arrow = direction === "up" ? "↑ Increasing" : direction === "down" ? "↓ Decreasing" : "→ No clear trend";
  const flip = x > 280;
  return (
    <div className="tooltip" style={{ left: flip ? x - 246 : x + 16, top: Math.max(12, y - 20) }} role="tooltip">
      <p className="kicker">Simulated</p>
      <h3>{region.name}</h3>
      <p className="kicker">{mode === "anomaly" ? `${spec.label} anomaly` : spec.label}</p>
      {reading === null ? (
        <p>NO DATA AVAILABLE</p>
      ) : (
        <div className="tip-figure">{mode === "anomaly" ? formatSigned(reading, spec.anomalyUnit === "°C" ? 1 : 0, spec.anomalyUnit === "°C" ? "°C" : "") : formatNumber(reading, 0)}</div>
      )}
      <dl>
        <dt>Extreme heat days</dt>
        <dd>{formatNumber(profile?.focus && hazard === "heat" ? series.heat_days[dataset.years.indexOf(year)] : series.heat_days[dataset.years.indexOf(year)], 0)}</dd>
        <dt>Temperature anomaly</dt>
        <dd>{formatSigned(profile?.temperature.anomaly ?? null, 1, "°C")}</dd>
        <dt>Trend</dt>
        <dd>{profile?.available ? arrow : "—"}</dd>
      </dl>
      <em>Click to explore</em>
    </div>
  );
}

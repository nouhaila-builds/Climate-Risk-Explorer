import { buildTrendPoints, globalSeries } from "../analytics";
import { useClimateData } from "../data/ClimateData";
import { HAZARD_MAP } from "../encoding";
import { changePhrase } from "../insights";
import { percentChange, periodMean } from "../stats";
import { useExplorerStore } from "../store";
import { TrendChart } from "../components/Trends/TrendChart";

export function TimelinePage() {
  const { dataset } = useClimateData();
  const year = useExplorerStore((state) => state.year);
  const hazard = useExplorerStore((state) => state.hazard);
  const region = useExplorerStore((state) => state.region);
  const start = useExplorerStore((state) => state.start);
  const end = useExplorerStore((state) => state.end);
  const b0 = useExplorerStore((state) => state.b0);
  const b1 = useExplorerStore((state) => state.b1);
  if (!dataset) return null;
  const spec = HAZARD_MAP[hazard];
  const selected = region ? dataset.series[region]?.[spec.absolute] : null;
  const values = selected ?? globalSeries(dataset, spec.absolute);
  const points = buildTrendPoints(dataset.years, values, 1980, 2025, b0, b1, values);
  const early = periodMean(dataset.years, values, 1980, 2000);
  const recent = periodMean(dataset.years, values, 2005, 2025);
  const name = region ? dataset.regions.find((item) => item.code === region)?.name : "The global mean";
  return (
    <>
      <div className="year-hero" aria-hidden="true">{year}</div>
      <p className="global-note">
        {name} {spec.label.toLowerCase()} index {changePhrase(percentChange(recent, early))} from the 1980–2000 mean
        {early !== null && recent !== null ? ` (${early.toFixed(0)} → ${recent.toFixed(0)}).` : "."} Simulated series, {start}–{end} is the analysis window.
      </p>
      <div className="slim-chart">
        <TrendChart points={points} hazard={hazard} compact />
      </div>
    </>
  );
}

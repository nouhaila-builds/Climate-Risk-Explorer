import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useClimateData } from "../data/ClimateData";
import { anomaly, baselineMean, periodMean } from "../stats";
import { useExplorerStore } from "../store";
import { formatSigned } from "../format";

export function OverviewPage() {
  const navigate = useNavigate();
  const { dataset } = useClimateData();
  const setYear = useExplorerStore((state) => state.setYear);
  const setPlaying = useExplorerStore((state) => state.setPlaying);
  const facts = useMemo(() => {
    if (!dataset) return null;
    const anomalyMean = dataset.regions.reduce(
      (summary, region) => {
        const series = dataset.series[region.code];
        const index = dataset.years.indexOf(2025);
        if (!series || !series.coverage[index]) return summary;
        const value = anomaly(series.temperature[index], baselineMean(dataset.years, series.temperature, 1980, 2000));
        if (value === null) return summary;
        summary.total += value;
        summary.count += 1;
        return summary;
      },
      { total: 0, count: 0 },
    );
    let leader = { name: "—", delta: -Infinity };
    let rising = 0;
    dataset.regions.forEach((region) => {
      const series = dataset.series[region.code]?.heat_risk;
      if (!series) return;
      const base = baselineMean(dataset.years, series, 1980, 2000);
      const recent = periodMean(dataset.years, series, 2005, 2025);
      if (base === null || recent === null) return;
      const delta = recent - base;
      if (delta > 10) rising += 1;
      if (delta > leader.delta) leader = { name: region.name, delta };
    });
    return {
      anomaly: anomalyMean.count ? anomalyMean.total / anomalyMean.count : null,
      leader: leader.name,
      leaderDelta: Number.isFinite(leader.delta) ? leader.delta : null,
      rising,
    };
  }, [dataset]);

  return (
    <section className="hero">
      <div className="hero-copy">
        <h1>A changing climate has a geography.</h1>
        <p className="lede">Explore four decades of climate risk across regions, hazards and time.</p>
        <p className="kicker">{dataset?.meta.label ?? "Temperature · ERA5 / OWID · other hazards simulated"}</p>
        <button
          className="start"
          onClick={() => {
            setYear(1980);
            setPlaying(true);
            navigate("/map");
          }}
        >
          Start exploring
        </button>
        {facts && (
          <div className="facts">
            <div>
              <strong>{formatSigned(facts.anomaly, 1, "°C")}</strong>
              <span>mean temperature anomaly, 2025</span>
            </div>
            <div>
              <strong>{facts.leader}</strong>
              <span>largest rise in the heat index, {facts.leaderDelta === null ? "—" : `+${facts.leaderDelta.toFixed(0)}`}</span>
            </div>
            <div>
              <strong>{facts.rising}</strong>
              <span>regions whose heat index rose by more than 10 points</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

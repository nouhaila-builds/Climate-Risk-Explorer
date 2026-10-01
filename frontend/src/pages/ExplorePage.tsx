import { useEffect, useState } from "react";
import { buildProfile, buildTrendPoints, simulatedEvents, storySteps } from "../analytics";
import { BaselineComparison } from "../components/Trends/BaselineComparison";
import { ClimateStripes } from "../components/Trends/ClimateStripes";
import { TrendChart } from "../components/Trends/TrendChart";
import { ExtremeEvents } from "../components/Investigation/ExtremeEvents";
import { SeasonalityView } from "../components/Investigation/SeasonalityView";
import { useClimateData } from "../data/ClimateData";
import { HAZARD_MAP } from "../encoding";
import { useSeasonality } from "../hooks/useSeasonality";
import { anomaly, baselineMean } from "../stats";
import { useExplorerStore } from "../store";

export function ExplorePage() {
  const { dataset } = useClimateData();
  const region = useExplorerStore((state) => state.region);
  const hazard = useExplorerStore((state) => state.hazard);
  const year = useExplorerStore((state) => state.year);
  const start = useExplorerStore((state) => state.start);
  const end = useExplorerStore((state) => state.end);
  const b0 = useExplorerStore((state) => state.b0);
  const b1 = useExplorerStore((state) => state.b1);
  const [active, setActive] = useState("pattern");
  const { months, status } = useSeasonality(region, hazard, start, end);

  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-step]"));
    if (!nodes.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const step = visible?.target.getAttribute("data-step");
        if (step) setActive(step);
      },
      { root: document.querySelector(".explore-story"), threshold: [0.45] },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [region, hazard, months]);

  if (!dataset) return null;
  if (!region) {
    return (
      <section className="compare-page">
        <p className="empty-state">Select a territory on the map, or open a hotspot, to follow the evidence for one place.</p>
      </section>
    );
  }
  const meta = dataset.regions.find((item) => item.code === region);
  const profile = buildProfile(dataset, region, hazard, year, start, end, b0, b1);
  const spec = HAZARD_MAP[hazard];
  if (!meta || !profile?.available) {
    return <section className="compare-page"><p>NO DATA AVAILABLE</p></section>;
  }
  const points = buildTrendPoints(dataset.years, dataset.series[region][spec.detail], start, end, b0, b1);
  const stripes = dataset.years.map((item, index) => ({
    year: item,
    anomaly: anomaly(dataset.series[region].temperature[index], baselineMean(dataset.years, dataset.series[region].temperature, b0, b1)),
  }));
  const events = simulatedEvents(dataset.years, dataset.series[region][spec.detail], spec.short).filter((event) => event.year >= start && event.year <= end);
  const peak = status === "ready"
    ? (months ?? []).filter((month) => month.value !== null).sort((a, b) => (b.value ?? 0) - (a.value ?? 0)).slice(0, 3).sort((a, b) => a.month - b.month).map((month) => month.label)
    : [];
  const steps = storySteps(dataset, region, hazard, year, start, end, b0, b1, peak);
  if (status === "loading") {
    const season = steps.find((step) => step.id === "seasonality");
    if (season) season.insight = "The monthly series is loading.";
  }
  if (status === "error") {
    const season = steps.find((step) => step.id === "seasonality");
    if (season) season.insight = "NO DATA AVAILABLE for the seasonal view.";
  }

  return (
    <div className="explore-page">
      <div className="explore-grid">
        <div className={`explore-stage ${active === "pattern" ? "is-clear" : "is-solid"}`}>
          <p className="kicker">Investigation · simulated · {meta.name}</p>
          {active === "pattern" && <p className="story-prose">The map stays in view. {meta.name} is the territory under the lens.</p>}
          {active === "trend" && (
            <>
              <TrendChart points={points} hazard={hazard} />
              <ClimateStripes stripes={stripes} />
            </>
          )}
          {active === "baseline" && (
            <BaselineComparison
              hazard={hazard}
              baselineLabel={`${b0}–${b1}`}
              recentLabel={`${start}–${end}`}
              baseline={profile.focus.baselineMean}
              recent={profile.focus.periodMean}
              change={profile.focus.changePercent}
            />
          )}
          {active === "seasonality" && (status === "loading" ? <div className="loading-line" /> : <SeasonalityView hazard={hazard} months={months} />)}
          {active === "extremes" && <ExtremeEvents events={events} />}
          {active === "related" && <p className="story-prose">{steps.find((step) => step.id === "related")?.insight}</p>}
          {profile.warning && <p className="warning">{profile.warning}</p>}
        </div>
        <article className="explore-story">
          <p className="kicker">Why does the series look like this?</p>
          <h2>How is {spec.label.toLowerCase()} changing in {meta.name}?</h2>
          {steps.map((step, index) => (
            <section key={step.id} data-step={step.id} className={active === step.id ? "is-active" : ""}>
              <p className="kicker">0{index + 1}</p>
              <h2>{step.title}</h2>
              <p className="story-prose">{step.insight}</p>
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}

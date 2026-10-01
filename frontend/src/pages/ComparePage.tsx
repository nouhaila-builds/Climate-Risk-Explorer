import { useMemo, useState } from "react";
import { buildProfile, buildTrendPoints } from "../analytics";
import { ClimateFingerprint } from "../components/RiskProfile/ClimateFingerprint";
import { useClimateData } from "../data/ClimateData";
import { COMPARE_DASHES, COMPARE_STROKES, HAZARD_MAP } from "../encoding";
import { useHoverStore } from "../hoverStore";
import { useExplorerStore } from "../store";
import { curveMonotoneX, line } from "d3-shape";
import { scaleLinear } from "d3-scale";

export function ComparePage() {
  const { dataset } = useClimateData();
  const compare = useExplorerStore((state) => state.compare);
  const hazard = useExplorerStore((state) => state.hazard);
  const start = useExplorerStore((state) => state.start);
  const end = useExplorerStore((state) => state.end);
  const b0 = useExplorerStore((state) => state.b0);
  const b1 = useExplorerStore((state) => state.b1);
  const year = useExplorerStore((state) => state.year);
  const highlighted = useHoverStore((state) => state.code);
  const [draft, setDraft] = useState("");
  const spec = HAZARD_MAP[hazard];
  const regions = dataset?.regions ?? [];
  const profiles = useMemo(
    () => compare.map((code) => ({ code, profile: dataset ? buildProfile(dataset, code, hazard, year, start, end, b0, b1) : null })),
    [b0, b1, compare, dataset, end, hazard, start, year],
  );

  if (!dataset) return null;
  const series = compare.map((code) => buildTrendPoints(dataset.years, dataset.series[code][spec.detail], start, end, b0, b1));
  const years = series[0]?.map((point) => point.year) ?? [];
  const flat = series.flatMap((points) => points.map((point) => point.value)).filter((value): value is number => value !== null);
  const y = scaleLinear().domain([Math.min(0, ...flat), Math.max(1, ...flat)]).range([300, 20]);
  const x = scaleLinear().domain([years[0] ?? start, years.at(-1) ?? end]).range([48, 680]);
  const path = line<{ year: number; value: number | null }>()
    .defined((point) => point.value !== null)
    .x((point) => x(point.year))
    .y((point) => y(point.value ?? 0))
    .curve(curveMonotoneX);

  return (
    <section className="compare-page">
      <p className="kicker">Up to four territories · identical scales</p>
      <h2>Trajectories, not a table.</h2>
      <form
        className="search"
        onSubmit={(event) => {
          event.preventDefault();
          const match = regions.find((item) => item.name.toLowerCase() === draft.trim().toLowerCase() || item.code.toLowerCase() === draft.trim().toLowerCase());
          if (!match) return;
          if (compare.length >= 4) return;
          useExplorerStore.getState().addCompare(match.code);
          setDraft("");
        }}
      >
        <input aria-label="Add a region to compare" placeholder="Add France, Spain, Morocco…" value={draft} onChange={(event) => setDraft(event.target.value)} />
        <button type="submit">Add</button>
      </form>
      <div className="chips">
        {compare.map((code, index) => (
          <button key={code} className="chip" onClick={() => useExplorerStore.getState().removeCompare(code)}>
            <span style={{ color: COMPARE_STROKES[index] }}>{dataset.regions.find((item) => item.code === code)?.name}</span> ×
          </button>
        ))}
      </div>
      {compare.length < 2 && <p className="empty-state">Add at least two regions. Their hazard trajectories and fingerprints share one scale.</p>}
      {compare.length >= 4 && <p className="kicker">Four regions are the comparison limit.</p>}
      {compare.length > 0 && (
        <div className="compare-grid">
          <div>
            <p className="kicker">{spec.label} · {spec.detailUnit}</p>
            <svg viewBox="0 0 720 340" role="img" aria-label="Comparison trajectories">
              {series.map((points, index) => (
                <path
                  key={compare[index]}
                  d={path(points) ?? ""}
                  fill="none"
                  stroke={COMPARE_STROKES[index]}
                  strokeWidth={highlighted && highlighted !== compare[index] ? 1 : 2.4}
                  strokeDasharray={COMPARE_DASHES[index]}
                  opacity={!highlighted || highlighted === compare[index] ? 1 : 0.25}
                  onMouseEnter={() => useHoverStore.getState().setHover({ code: compare[index] })}
                  onMouseLeave={() => useHoverStore.getState().setHover({ code: null })}
                />
              ))}
              <text x="48" y="332" fill="#91A4AE" fontSize="11" fontFamily="IBM Plex Mono, monospace">{years[0]}</text>
              <text x="680" y="332" fill="#91A4AE" fontSize="11" textAnchor="end" fontFamily="IBM Plex Mono, monospace">{years.at(-1)}</text>
            </svg>
            <div className="chips">
              {compare.map((code, index) => (
                <button
                  key={code}
                  onMouseEnter={() => useHoverStore.getState().setHover({ code })}
                  onMouseLeave={() => useHoverStore.getState().setHover({ code: null })}
                >
                  <span style={{ borderTop: `2px ${COMPARE_DASHES[index] ? "dashed" : "solid"} ${COMPARE_STROKES[index]}`, paddingTop: 4 }}>
                    {dataset.regions.find((item) => item.code === code)?.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="multiples">
            {profiles.map(({ code, profile }) => {
              const name = dataset.regions.find((item) => item.code === code)?.name ?? code;
              return (
                <button
                  key={code}
                  className={`multiple ${highlighted && highlighted !== code ? "is-dim" : ""}`}
                  onMouseEnter={() => useHoverStore.getState().setHover({ code })}
                  onMouseLeave={() => useHoverStore.getState().setHover({ code: null })}
                >
                  <span>{name}</span>
                  <ClimateFingerprint risks={profile?.risks ?? null} size={180} center={profile?.risks[hazard] == null ? "—" : String(Math.round(profile.risks[hazard] ?? 0))} />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

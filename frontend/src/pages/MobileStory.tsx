import { useMemo, useState } from "react";
import { buildProfile, rankHotspots } from "../analytics";
import { ClimateFingerprint } from "../components/RiskProfile/ClimateFingerprint";
import { ClimateStripes } from "../components/Trends/ClimateStripes";
import { useClimateData } from "../data/ClimateData";
import { HAZARDS } from "../encoding";
import { formatSigned } from "../format";
import { anomaly, baselineMean } from "../stats";
import { useExplorerStore } from "../store";
import type { HazardId } from "../types";

export function MobileStory() {
  const { dataset, status, error, reload } = useClimateData();
  const region = useExplorerStore((state) => state.region);
  const hazard = useExplorerStore((state) => state.hazard);
  const year = useExplorerStore((state) => state.year);
  const b0 = useExplorerStore((state) => state.b0);
  const b1 = useExplorerStore((state) => state.b1);
  const [query, setQuery] = useState("");
  const hotspots = useMemo(() => (dataset ? rankHotspots(dataset, year, b0, b1, 5) : []), [b0, b1, dataset, year]);
  const code = region ?? hotspots[0]?.code ?? null;
  const profile = dataset && code ? buildProfile(dataset, code, hazard, year, 2005, 2025, b0, b1) : null;
  const name = dataset?.regions.find((item) => item.code === code)?.name;
  const stripes = dataset && code
    ? dataset.years.map((item, index) => ({
      year: item,
      anomaly: anomaly(dataset.series[code].temperature[index], baselineMean(dataset.years, dataset.series[code].temperature, b0, b1)),
    }))
    : [];
  const matches = (dataset?.regions ?? []).filter((item) => item.name.toLowerCase().includes(query.toLowerCase())).slice(0, 6);

  return (
    <article className="mobile-story">
      <p className="kicker">Climate Risk Explorer</p>
      <h1>A changing climate has a geography.</h1>
      <p>This is the narrative view. The full atlas — map, timeline, comparison — is built for a wide screen. All figures are simulated.</p>
      {status === "error" && <button onClick={reload}>{error}</button>}
      <label className="kicker" htmlFor="mobile-region">Region</label>
      <input id="mobile-region" value={query} placeholder={name ?? "Search"} onChange={(event) => setQuery(event.target.value)} />
      <ul>
        {matches.map((item) => (
          <li key={item.code}><button onClick={() => useExplorerStore.getState().selectRegion(item.code)}>{item.name}</button></li>
        ))}
      </ul>
      <div className="hazard-row">
        {HAZARDS.map((item) => (
          <button key={item.id} className={hazard === item.id ? "is-active" : ""} onClick={() => useExplorerStore.getState().setHazard(item.id as HazardId)}>
            {item.short}
          </button>
        ))}
      </div>
      {profile?.available && name ? (
        <>
          <p className="kicker">{name} · 2005–2025</p>
          <p className="value" style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 48 }}>{formatSigned(profile.temperature.anomaly, 1, "°C")}</p>
          <p>above the {b0}–{b1} baseline. {profile.trend.description}.</p>
          <ClimateFingerprint risks={profile.risks} size={260} center={profile.overall === null ? "—" : String(Math.round(profile.overall))} />
          <ClimateStripes stripes={stripes} />
        </>
      ) : (
        <p>NO DATA AVAILABLE</p>
      )}
      <h2>Places to look</h2>
      <ol>
        {hotspots.map((item) => (
          <li key={item.code}>
            <button onClick={() => useExplorerStore.getState().focusHotspot(item.code, item.hazard)}>{item.name} — {item.hazard}</button>
          </li>
        ))}
      </ol>
    </article>
  );
}

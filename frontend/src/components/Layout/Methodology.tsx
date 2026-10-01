import { useExplorerStore } from "../../store";

const ITEMS = [
  ["Temperature anomaly", "Country mean of ERA5 2 m temperature, from Our World in Data, minus the 1980–2000 mean. A year is used only when all twelve months are present."],
  ["Extreme heat days", "A normal-tail proxy for days whose daily maximum exceeds 30°C. February is treated as 28 days. This is not a station count."],
  ["Heat risk index", "100 × heat days / 72, clipped to 0–100. The cap keeps mid-latitude change visible."],
  ["Drought index", "A precipitation-deficit and temperature-excess proxy centered near 30 in the baseline climate. It is not SPEI."],
  ["Extreme precipitation", "Scaled from how far the wettest month exceeds its 1980–2000 monthly climatology."],
  ["Flood, wildfire, storm", "Exposure-weighted 0–100 indices. Fuel and coastal exposure are scenario factors in the simulator."],
  ["Trend", "Ordinary least squares on year, shown when at least 8 observations exist. The band is a 95% interval for the fitted mean."],
  ["Rolling average", "Trailing five-year mean. A window that contains a missing year is left empty rather than filled with zero."],
  ["Combined risk", "0.24 heat + 0.20 drought + 0.16 flood + 0.14 precipitation + 0.16 wildfire + 0.10 storm. Any missing component makes the total missing."],
];

export function Methodology() {
  const open = useExplorerStore((state) => state.methodologyOpen);
  if (!open) return null;
  return (
    <aside className="drawer" aria-label="How the indicators are calculated">
      <header>
        <p className="kicker">Method · temperature observed · other hazards simulated</p>
        <button className="close-x" aria-label="Close method" onClick={() => useExplorerStore.getState().setMethodologyOpen(false)}>×</button>
      </header>
      <h2>How is this calculated?</h2>
      {ITEMS.map(([title, body]) => (
        <article key={title}>
          <h3>{title}</h3>
          <p>{body}</p>
        </article>
      ))}
      <p className="kicker">Temperature is ERA5 via Our World in Data. Heat days, drought, precipitation, flood, wildfire and storm are still simulated.</p>
    </aside>
  );
}

import { useEffect, useMemo, useState } from "react";
import { HAZARDS } from "../../encoding";
import { useClimateData } from "../../data/ClimateData";
import { useExplorerStore } from "../../store";
import type { HazardId, ViewMode } from "../../types";

const QUESTIONS: Record<string, string | null> = {
  "/": null,
  "/map": "Where is climate risk highest?",
  "/timeline": "How has the spatial pattern changed?",
  "/hazards": "What does this hazard look like?",
  "/compare": "How do these regions differ?",
  "/hotspots": "Where are unusual patterns emerging?",
  "/explore": "What pattern is the series showing?",
};

export function Header() {
  const view = useExplorerStore((state) => state.view);
  const hazard = useExplorerStore((state) => state.hazard);
  const mode = useExplorerStore((state) => state.mode);
  const setHazard = useExplorerStore((state) => state.setHazard);
  const setMode = useExplorerStore((state) => state.setMode);
  const question = QUESTIONS[view] ?? null;
  return (
    <header className={`atlas-head ${view === "/" ? "is-overview" : ""}`}>
      <div>
        <div className="wordmark">Climate Risk Explorer</div>
        {question && <p className="question">{question}</p>}
      </div>
      <div className="head-tools">
        <RegionSearch />
        <div className="mode-switch" role="group" aria-label="Value mode">
          {(["absolute", "anomaly"] as ViewMode[]).map((item) => (
            <button key={item} className={mode === item ? "is-active" : ""} aria-pressed={mode === item} onClick={() => setMode(item)}>
              {item}
            </button>
          ))}
        </div>
        <BaselineControl />
        <button className="text-button" onClick={() => useExplorerStore.getState().setMethodologyOpen(true)}>
          How is this calculated?
        </button>
      </div>
      <div className="hazard-row" role="tablist" aria-label="Climate hazard">
        {HAZARDS.map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={hazard === item.id}
            className={hazard === item.id ? "is-active" : ""}
            onClick={() => setHazard(item.id as HazardId)}
          >
            <i style={{ background: item.stops[1] }} />
            {item.short}
          </button>
        ))}
      </div>
    </header>
  );
}

function RegionSearch() {
  const { dataset } = useClimateData();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const region = useExplorerStore((state) => state.region);
  const matches = useMemo(() => {
    const regions = dataset?.regions ?? [];
    const needle = query.trim().toLowerCase();
    return regions
      .filter((item) => !needle || item.name.toLowerCase().includes(needle) || item.code.toLowerCase().includes(needle))
      .slice(0, 8);
  }, [dataset, query]);

  useEffect(() => setCursor(0), [query]);

  return (
    <div className="search">
      <label className="kicker" htmlFor="region-search">Region</label>
      <input
        id="region-search"
        role="combobox"
        aria-expanded={open}
        aria-controls="region-options"
        placeholder={region ?? "Search a territory"}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setCursor((index) => Math.min(matches.length - 1, index + 1));
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setCursor((index) => Math.max(0, index - 1));
          }
          if (event.key === "Enter" && matches[cursor]) {
            useExplorerStore.getState().selectRegion(matches[cursor].code);
            setQuery("");
            setOpen(false);
          }
          if (event.key === "Escape") setOpen(false);
        }}
      />
      {open && (
        <ul id="region-options" role="listbox">
          {matches.map((item, index) => (
            <li key={item.code}>
              <button
                role="option"
                aria-selected={index === cursor}
                className={index === cursor ? "is-active" : ""}
                onMouseDown={(event) => {
                  event.preventDefault();
                  useExplorerStore.getState().selectRegion(item.code);
                  setQuery("");
                  setOpen(false);
                }}
              >
                {item.name}
                <small>{item.code}</small>
              </button>
            </li>
          ))}
          {!matches.length && <li><button disabled>NO DATA AVAILABLE</button></li>}
        </ul>
      )}
    </div>
  );
}

function BaselineControl() {
  const b0 = useExplorerStore((state) => state.b0);
  const b1 = useExplorerStore((state) => state.b1);
  const setBaseline = useExplorerStore((state) => state.setBaseline);
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(String(b0));
  const [end, setEnd] = useState(String(b1));
  return (
    <div className="baseline-pop">
      <button aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        Baseline {b0}–{b1}
      </button>
      {open && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setBaseline(Number(start), Number(end));
            setOpen(false);
          }}
        >
          <input aria-label="Baseline start" value={start} onChange={(event) => setStart(event.target.value)} />
          <input aria-label="Baseline end" value={end} onChange={(event) => setEnd(event.target.value)} />
          <button type="submit">Apply</button>
        </form>
      )}
    </div>
  );
}

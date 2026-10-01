import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { buildProfile } from "../../analytics";
import { useClimateData } from "../../data/ClimateData";
import { HAZARD_MAP } from "../../encoding";
import { formatNumber, formatPercent } from "../../format";
import { useExplorerStore } from "../../store";
import { ClimateFingerprint } from "../RiskProfile/ClimateFingerprint";
import { Figure } from "../ui/Figure";

export function DetailPanel() {
  const { dataset } = useClimateData();
  const region = useExplorerStore((state) => state.region);
  const open = useExplorerStore((state) => state.panelOpen);
  const view = useExplorerStore((state) => state.view);
  const hazard = useExplorerStore((state) => state.hazard);
  const year = useExplorerStore((state) => state.year);
  const start = useExplorerStore((state) => state.start);
  const end = useExplorerStore((state) => state.end);
  const b0 = useExplorerStore((state) => state.b0);
  const b1 = useExplorerStore((state) => state.b1);
  const reduce = useReducedMotion();
  if (!open || !region || !dataset || view === "/compare" || view === "/explore") return null;
  const meta = dataset.regions.find((item) => item.code === region);
  const profile = buildProfile(dataset, region, hazard, year, start, end, b0, b1);
  const spec = HAZARD_MAP[hazard];
  if (!meta || !profile) return null;
  return (
    <motion.aside
      className="detail-panel"
      initial={reduce ? false : { x: 24, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: reduce ? 0 : 0.35 }}
      aria-label={`${meta.name} climate profile`}
    >
      <header>
        <div>
          <p className="kicker">Climate risk profile · simulated</p>
          <h2>{meta.name}</h2>
          <p className="kicker">{start} — {end} · map year {year}</p>
        </div>
        <button className="close-x" aria-label="Close profile" onClick={() => useExplorerStore.getState().setPanelOpen(false)}>×</button>
      </header>
      {!profile.available ? (
        <p>NO DATA AVAILABLE</p>
      ) : (
        <>
          <ClimateFingerprint risks={profile.risks} center={profile.overall === null ? "—" : String(Math.round(profile.overall))} size={230} />
          <div className="figure-stack">
            <div>
              <Figure className="value" value={profile.temperature.anomaly} digits={1} signed suffix="°C" />
              <small>temperature anomaly vs {b0}–{b1}</small>
            </div>
            <div>
              <Figure className="value" value={profile.focus.periodMean} digits={spec.detailUnit === "index" ? 0 : 1} />
              <small>{spec.label.toLowerCase()} · {spec.detailUnit} / year</small>
            </div>
            <div>
              <span className="value">{formatPercent(profile.focus.changePercent)}</span>
              <small>versus the historical baseline</small>
            </div>
          </div>
          <p>{spec.label} in {meta.name} {profile.trend.description}.</p>
          <p className="kicker">Map reading {formatNumber(profile.focus.current, 1)} {spec.detailUnit} in {year}</p>
          {profile.coverage !== null && profile.coverage < 0.999 && (
            <p className="kicker">Data coverage {Math.round(profile.coverage * 100)}%</p>
          )}
          {profile.warning && <p className="warning">{profile.warning}</p>}
          <div className="panel-actions">
            <Link to="/explore">Investigate</Link>
            <button
              onClick={() => {
                useExplorerStore.getState().addCompare(region);
              }}
            >
              Add to compare
            </button>
          </div>
        </>
      )}
    </motion.aside>
  );
}

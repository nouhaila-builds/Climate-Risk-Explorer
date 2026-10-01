import { HAZARD_MAP, cssGradient } from "../../encoding";
import { useExplorerStore } from "../../store";

export function MapLegend() {
  const hazard = useExplorerStore((state) => state.hazard);
  const mode = useExplorerStore((state) => state.mode);
  const view = useExplorerStore((state) => state.view);
  const year = useExplorerStore((state) => state.year);
  const start = useExplorerStore((state) => state.start);
  const end = useExplorerStore((state) => state.end);
  const b0 = useExplorerStore((state) => state.b0);
  const b1 = useExplorerStore((state) => state.b1);
  if (view === "/" || view === "/compare") return null;
  const spec = HAZARD_MAP[hazard];
  const anomaly = mode === "anomaly" && view !== "/hotspots";
  const title = view === "/hotspots" ? "Combined risk index" : anomaly ? `${spec.label} anomaly` : spec.label;
  return (
    <div className={`legend ${view === "/hazards" || view === "/hotspots" ? "is-aside" : ""}`}>
      <p className="kicker">{anomaly && hazard === "heat" ? "Temperature · ERA5 / Our World in Data" : "Legend · simulated"}</p>
      <strong>{title}</strong>
      <div className="legend-bar" style={{ background: view === "/hotspots" ? "linear-gradient(90deg,#8FA8B3,#C4A574,#8E3B32)" : cssGradient(anomaly ? "anomaly" : "absolute", hazard) }} />
      <div className="legend-scale">
        {anomaly ? (
          <>
            <span>{spec.anomalyMin}{spec.anomalyUnit}</span>
            <span>baseline</span>
            <span>+{spec.anomalyMax}{spec.anomalyUnit}</span>
          </>
        ) : (
          <>
            <span>Low 0</span>
            <span>High 100</span>
          </>
        )}
      </div>
      <p className="legend-note">
        <span className="hatch-key" />
        No data · map year {year}
        <br />
        Analysis {start}–{end}
        {anomaly ? ` · baseline ${b0}–${b1}` : ""}
      </p>
    </div>
  );
}

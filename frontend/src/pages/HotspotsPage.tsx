import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { rankHotspots } from "../analytics";
import { useClimateData } from "../data/ClimateData";
import { HAZARD_MAP } from "../encoding";
import { formatNumber, formatSigned } from "../format";
import { useExplorerStore } from "../store";

export function HotspotsPage() {
  const { dataset } = useClimateData();
  const year = useExplorerStore((state) => state.year);
  const b0 = useExplorerStore((state) => state.b0);
  const b1 = useExplorerStore((state) => state.b1);
  const navigate = useNavigate();
  const hotspots = useMemo(() => (dataset ? rankHotspots(dataset, year, b0, b1, 8) : []), [b0, b1, dataset, year]);
  return (
    <div className="scrim-page">
      <div className="hotspot-list">
        <p className="kicker">Climate risk hotspots · simulated · {year}</p>
        <h2>Where change and exposure coincide.</h2>
        <ol>
          {hotspots.map((hotspot, index) => (
            <li key={hotspot.code}>
              <button
                onClick={() => {
                  useExplorerStore.getState().focusHotspot(hotspot.code, hotspot.hazard);
                  navigate("/explore");
                }}
              >
                <span className="rank">{String(index + 1).padStart(2, "0")}</span>
                <span>
                  <h3>{hotspot.name}</h3>
                  <p>
                    {HAZARD_MAP[hotspot.hazard].label} · risk {formatNumber(hotspot.risk, 0)}
                  </p>
                  <p>
                    {hotspot.anomaly === null ? "NO DATA AVAILABLE" : `${formatSigned(hotspot.anomaly, 1)} ${HAZARD_MAP[hotspot.hazard].anomalyUnit} vs baseline`}
                    {hotspot.reasons.length ? ` · ${hotspot.reasons.join(", ")}` : ""}
                  </p>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

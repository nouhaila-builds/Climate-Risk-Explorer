import { buildProfile } from "../analytics";
import { ClimateFingerprint } from "../components/RiskProfile/ClimateFingerprint";
import { useClimateData } from "../data/ClimateData";
import { HAZARD_MAP } from "../encoding";
import { useExplorerStore } from "../store";

export function HazardsPage() {
  const { dataset } = useClimateData();
  const hazard = useExplorerStore((state) => state.hazard);
  const region = useExplorerStore((state) => state.region);
  const year = useExplorerStore((state) => state.year);
  const start = useExplorerStore((state) => state.start);
  const end = useExplorerStore((state) => state.end);
  const b0 = useExplorerStore((state) => state.b0);
  const b1 = useExplorerStore((state) => state.b1);
  const spec = HAZARD_MAP[hazard];
  const profile = dataset && region ? buildProfile(dataset, region, hazard, year, start, end, b0, b1) : null;
  const name = dataset?.regions.find((item) => item.code === region)?.name;
  return (
    <div className="scrim-page">
      <div className="scrim-copy hazard-essay">
        <p className="kicker">{spec.short}</p>
        <h2>{spec.label}</h2>
        <p>{spec.summary}</p>
        <p className="formula">
          {hazard === "heat" && "heat risk = clip(100 × estimated days above 30°C / 72, 0, 100)"}
          {hazard === "drought" && "drought ≈ 30 + 48 × (precipitation deficit × bias + 0.14 × temperature anomaly)"}
          {hazard === "flood" && "flood = exposure weight × wet-month intensity, scaled 0–100"}
          {hazard === "precipitation" && "precipitation risk = clip(100 × (peak month ÷ climatology − 1) / 1.2, 0, 100)"}
          {hazard === "wildfire" && "wildfire = fuel × (0.62 × summer drought + 0.38 × heat risk)"}
          {hazard === "storm" && "storm = exposure climatology + a small trend + simulated variability"}
        </p>
        {profile?.available && name ? (
          <>
            <p className="kicker">{name} · {start}–{end}</p>
            <ClimateFingerprint risks={profile.risks} center={profile.risks[hazard] === null ? "—" : String(Math.round(profile.risks[hazard]))} />
          </>
        ) : (
          <p className="empty-state">Select a territory to see its climate fingerprint. The map remains the spatial view of this hazard.</p>
        )}
      </div>
    </div>
  );
}

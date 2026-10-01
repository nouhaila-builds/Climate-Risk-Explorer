import { useClimateData } from "../data/ClimateData";

export function MapPage() {
  const { dataset } = useClimateData();
  const label = dataset?.meta.label ?? "Temperature · ERA5 / OWID · other hazards simulated";
  return <p className="credit">Boundaries · Natural Earth · {label}</p>;
}

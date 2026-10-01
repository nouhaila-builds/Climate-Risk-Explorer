import { formatSigned } from "../../format";
import { useHoverStore } from "../../hoverStore";

interface Stripe {
  year: number;
  anomaly: number | null;
}

function stripeColor(anomaly: number | null): string {
  if (anomaly === null) return "repeating-linear-gradient(135deg,#132028,#132028 2px,#2a3b44 2px,#2a3b44 3px)";
  const clamped = Math.max(-2.5, Math.min(2.5, anomaly));
  const t = (clamped + 2.5) / 5;
  const mix = (a: number[], b: number[], amount: number) => a.map((channel, index) => Math.round(channel + (b[index] - channel) * amount));
  const cool: number[] = [47, 111, 143];
  const mid: number[] = [143, 160, 168];
  const warm: number[] = [142, 47, 47];
  const rgb = t < 0.5 ? mix(cool, mid, t / 0.5) : mix(mid, warm, (t - 0.5) / 0.5);
  return `rgb(${rgb.join(",")})`;
}

export function ClimateStripes({ stripes }: { stripes: Stripe[] }) {
  const year = useHoverStore((state) => state.year);
  return (
    <div className="stripes" role="list" aria-label="Temperature anomaly stripes, ERA5 via Our World in Data">
      {stripes.map((stripe) => (
        <button
          key={stripe.year}
          role="listitem"
          className={year === stripe.year ? "is-active" : ""}
          style={{ background: stripeColor(stripe.anomaly) }}
          title={stripe.anomaly === null ? `${stripe.year}: NO DATA AVAILABLE` : `${stripe.year}: ${formatSigned(stripe.anomaly, 1, "°C")}`}
          aria-label={stripe.anomaly === null ? `${stripe.year}, no data available` : `${stripe.year}, anomaly ${formatSigned(stripe.anomaly, 1, " degrees")}`}
          onMouseEnter={() => useHoverStore.getState().setHover({ year: stripe.year })}
          onMouseLeave={() => useHoverStore.getState().setHover({ year: null })}
        />
      ))}
    </div>
  );
}

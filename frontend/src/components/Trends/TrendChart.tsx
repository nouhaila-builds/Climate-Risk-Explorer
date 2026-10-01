import { useMemo, useRef, useState } from "react";
import { area, curveMonotoneX, line } from "d3-shape";
import { scaleLinear } from "d3-scale";
import { HAZARD_MAP } from "../../encoding";
import { formatNumber, formatSigned } from "../../format";
import { useHoverStore } from "../../hoverStore";
import type { HazardId, TrendPoint } from "../../types";

interface TrendChartProps {
  points: TrendPoint[];
  hazard: HazardId;
  compact?: boolean;
}

export function TrendChart({ points, hazard, compact = false }: TrendChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const spec = HAZARD_MAP[hazard];
  const width = 720;
  const height = compact ? 150 : 360;
  const margin = { top: 16, right: 12, bottom: 28, left: 42 };
  const numeric = points.flatMap((point) => [point.value, point.bandLow, point.bandHigh, point.baseline]).filter((value): value is number => value !== null);
  const yMin = numeric.length ? Math.min(...numeric) : 0;
  const yMax = numeric.length ? Math.max(...numeric) : 1;
  const y = useMemo(() => scaleLinear().domain([yMin - (yMax - yMin) * 0.08, yMax + (yMax - yMin) * 0.1 || 1]).range([height - margin.bottom, margin.top]), [height, yMax, yMin]);
  const x = useMemo(() => {
    const years = points.map((point) => point.year);
    return scaleLinear().domain([Math.min(...years), Math.max(...years)]).range([margin.left, width - margin.right]);
  }, [points]);

  const annual = line<TrendPoint>().defined((point) => point.value !== null).x((point) => x(point.year)).y((point) => y(point.value ?? 0)).curve(curveMonotoneX);
  const smooth = line<TrendPoint>().defined((point) => point.rolling !== null).x((point) => x(point.year)).y((point) => y(point.rolling ?? 0)).curve(curveMonotoneX);
  const band = area<TrendPoint>().defined((point) => point.bandLow !== null && point.bandHigh !== null).x((point) => x(point.year)).y0((point) => y(point.bandLow ?? 0)).y1((point) => y(point.bandHigh ?? 0));
  const departure = area<TrendPoint>()
    .defined((point) => point.value !== null && point.baseline !== null)
    .x((point) => x(point.year))
    .y0((point) => y(point.baseline ?? 0))
    .y1((point) => y(point.value ?? 0));
  const active = hover === null ? null : points.find((point) => point.year === hover) ?? null;
  const baseline = points.find((point) => point.baseline !== null)?.baseline ?? null;

  return (
    <div className="chart-frame" ref={wrapRef} style={{ height }}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${spec.label} time series`}>
        {baseline !== null && (
          <line x1={margin.left} x2={width - margin.right} y1={y(baseline)} y2={y(baseline)} stroke="#91A4AE" strokeDasharray="3 4" />
        )}
        <path d={band(points) ?? ""} fill={spec.stops[1]} opacity="0.15" />
        <path d={departure(points) ?? ""} fill={spec.stops[1]} opacity="0.18" />
        <path d={annual(points) ?? ""} fill="none" stroke="rgba(242,246,248,0.45)" strokeWidth="1" />
        <path d={smooth(points) ?? ""} fill="none" stroke={spec.stops[1]} strokeWidth="2.2" />
        {points.filter((point) => point.percentile !== null && point.percentile >= 95 && point.value !== null).map((point) => (
          <circle key={point.year} cx={x(point.year)} cy={y(point.value ?? 0)} r="2.5" fill="#F2F6F8" />
        ))}
        {active?.value !== null && active && <line x1={x(active.year)} x2={x(active.year)} y1={margin.top} y2={height - margin.bottom} stroke="rgba(242,246,248,0.35)" />}
        <text x={margin.left} y={height - 8} fill="#91A4AE" fontSize="11" fontFamily="IBM Plex Mono, monospace">{points[0]?.year}</text>
        <text x={width - margin.right} y={height - 8} fill="#91A4AE" fontSize="11" textAnchor="end" fontFamily="IBM Plex Mono, monospace">{points.at(-1)?.year}</text>
        <rect
          x={margin.left}
          y={margin.top}
          width={width - margin.left - margin.right}
          height={height - margin.top - margin.bottom}
          fill="transparent"
          onMouseMove={(event) => {
            const bounds = event.currentTarget.getBoundingClientRect();
            const ratio = (event.clientX - bounds.left) / bounds.width;
            const year = Math.round((points[0]?.year ?? 1980) + ratio * ((points.at(-1)?.year ?? 2025) - (points[0]?.year ?? 1980)));
            setHover(year);
            useHoverStore.getState().setHover({ year });
          }}
          onMouseLeave={() => {
            setHover(null);
            useHoverStore.getState().setHover({ year: null });
          }}
        />
      </svg>
      {active && (
        <div className="chart-tip" style={{ left: Math.min(width - 190, Math.max(8, x(active.year) * ((wrapRef.current?.clientWidth ?? width) / width))) }}>
          <strong>{active.year}</strong>
          <p><span>{spec.label}</span><b>{formatNumber(active.value, spec.detailUnit === "days" || spec.detailUnit === "mm" ? 1 : 0)}</b></p>
          <p><span>Baseline</span><b>{formatNumber(active.baseline, 1)}</b></p>
          <p><span>Deviation</span><b>{formatSigned(active.anomaly, 1)}</b></p>
          <p><span>Percentile</span><b>{active.percentile === null ? "—" : `${Math.round(active.percentile)}th`}</b></p>
          <p className="kicker">Simulated</p>
        </div>
      )}
    </div>
  );
}

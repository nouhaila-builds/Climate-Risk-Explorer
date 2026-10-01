export type HazardId =
  | "heat"
  | "drought"
  | "flood"
  | "precipitation"
  | "wildfire"
  | "storm";

export type ViewMode = "absolute" | "anomaly";

export interface RegionMeta {
  code: string;
  name: string;
  continent: string;
  subregion: string;
  latitude: number;
  longitude: number;
  zone: string;
}

export interface AnnualSeries {
  temperature: (number | null)[];
  precipitation: (number | null)[];
  heat_days: (number | null)[];
  drought_index: (number | null)[];
  flood_risk: (number | null)[];
  wildfire_risk: (number | null)[];
  storm_risk: (number | null)[];
  heat_risk: (number | null)[];
  drought_risk: (number | null)[];
  precipitation_risk: (number | null)[];
  overall_risk: (number | null)[];
  coverage: (number | null)[];
}

export type MetricKey = keyof AnnualSeries;

export interface Dataset {
  meta: {
    data_origin: string;
    label: string;
    notes: string[];
    baseline_start: number;
    baseline_end: number;
    hot_day_threshold_c?: number;
  };
  years: number[];
  regions: RegionMeta[];
  series: Record<string, AnnualSeries>;
}

export interface TrendPoint {
  year: number;
  value: number | null;
  rolling: number | null;
  baseline: number | null;
  anomaly: number | null;
  fitted: number | null;
  bandLow: number | null;
  bandHigh: number | null;
  percentile: number | null;
}

export interface TrendSummary {
  sufficient: boolean;
  slopePerYear: number | null;
  stderr: number | null;
  description: string;
  n: number;
}

export interface MetricSummary {
  current: number | null;
  periodMean: number | null;
  baselineMean: number | null;
  anomaly: number | null;
  changePercent: number | null;
}

export interface RegionProfile {
  available: boolean;
  coverage: number | null;
  sampleSize: number;
  warning: string | null;
  risks: Record<HazardId, number | null>;
  overall: number | null;
  temperature: MetricSummary;
  focus: MetricSummary;
  trend: TrendSummary;
}

export interface Hotspot {
  code: string;
  name: string;
  hazard: HazardId;
  score: number;
  risk: number;
  anomaly: number | null;
  reasons: string[];
  latitude: number;
  longitude: number;
}

export interface SimEvent {
  year: number;
  value: number;
  title: string;
  detail: string;
}

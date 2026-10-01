import type { HazardId, ViewMode } from "./types";

export interface HazardSpec {
  id: HazardId;
  label: string;
  short: string;
  absolute: "heat_risk" | "drought_risk" | "flood_risk" | "precipitation_risk" | "wildfire_risk" | "storm_risk";
  detail: "heat_days" | "drought_index" | "flood_risk" | "precipitation" | "wildfire_risk" | "storm_risk";
  detailUnit: string;
  anomalySource: "temperature" | "drought_index" | "flood_risk" | "precipitation" | "wildfire_risk" | "storm_risk";
  anomalyUnit: string;
  anomalyMin: number;
  anomalyMax: number;
  stops: [string, string, string];
  question: string;
  summary: string;
}

export const HAZARDS: HazardSpec[] = [
  {
    id: "heat",
    label: "Extreme Heat",
    short: "Heat",
    absolute: "heat_risk",
    detail: "heat_days",
    detailUnit: "days",
    anomalySource: "temperature",
    anomalyUnit: "°C",
    anomalyMin: -2.5,
    anomalyMax: 2.5,
    stops: ["#E6C35C", "#E07A3D", "#8E2F2F"],
    question: "Where is extreme heat risk highest?",
    summary: "Estimated days with a daily maximum above 30°C, scaled from 0 to 72 days.",
  },
  {
    id: "drought",
    label: "Drought",
    short: "Drought",
    absolute: "drought_risk",
    detail: "drought_index",
    detailUnit: "index",
    anomalySource: "drought_index",
    anomalyUnit: "index",
    anomalyMin: -35,
    anomalyMax: 35,
    stops: ["#E4D3AE", "#C4A15A", "#6B4A28"],
    question: "Where is dryness increasing?",
    summary: "A precipitation-deficit and temperature-excess proxy. Not a published drought index.",
  },
  {
    id: "flood",
    label: "Flood",
    short: "Flood",
    absolute: "flood_risk",
    detail: "flood_risk",
    detailUnit: "index",
    anomalySource: "flood_risk",
    anomalyUnit: "index",
    anomalyMin: -40,
    anomalyMax: 40,
    stops: ["#8ED0D2", "#2E7D9A", "#143E5A"],
    question: "Where is flood exposure highest?",
    summary: "Exposure-weighted index of unusually wet conditions.",
  },
  {
    id: "precipitation",
    label: "Extreme Precipitation",
    short: "Precipitation",
    absolute: "precipitation_risk",
    detail: "precipitation",
    detailUnit: "mm",
    anomalySource: "precipitation",
    anomalyUnit: "mm",
    anomalyMin: -500,
    anomalyMax: 500,
    stops: ["#D5E4EF", "#5E8EAE", "#173A52"],
    question: "Where is precipitation most extreme?",
    summary: "How far the wettest month exceeds its 1980–2000 climatology.",
  },
  {
    id: "wildfire",
    label: "Wildfire",
    short: "Wildfire",
    absolute: "wildfire_risk",
    detail: "wildfire_risk",
    detailUnit: "index",
    anomalySource: "wildfire_risk",
    anomalyUnit: "index",
    anomalyMin: -40,
    anomalyMax: 40,
    stops: ["#F0B27A", "#C65B3E", "#6A2418"],
    question: "Where do heat and dryness overlap?",
    summary: "Overlap of summer heat, dryness, and a scenario fuel factor.",
  },
  {
    id: "storm",
    label: "Storm / Wind",
    short: "Storm",
    absolute: "storm_risk",
    detail: "storm_risk",
    detailUnit: "index",
    anomalySource: "storm_risk",
    anomalyUnit: "index",
    anomalyMin: -40,
    anomalyMax: 40,
    stops: ["#7ED0DE", "#3E7CB8", "#5C4D9A"],
    question: "Where is storm exposure concentrated?",
    summary: "Storm-track exposure with a mild simulated change over time.",
  },
];

export const HAZARD_MAP: Record<HazardId, HazardSpec> = Object.fromEntries(
  HAZARDS.map((hazard) => [hazard.id, hazard]),
) as Record<HazardId, HazardSpec>;

export const ANOMALY_STOPS = ["#2F6F8F", "#8FA0A8", "#C9842A", "#8E2F2F"];

export const COMPARE_STROKES = ["#E6C98A", "#7EB6C9", "#D27A55", "#C9C2B2"];
export const COMPARE_DASHES = ["", "5 3", "2 2", "8 3 2 3"];

export function scaleStops(mode: ViewMode, hazard: HazardId): { domain: number[]; colors: string[] } {
  if (mode === "anomaly") {
    const spec = HAZARD_MAP[hazard];
    const mid = (spec.anomalyMin + spec.anomalyMax) / 2;
    return {
      domain: [spec.anomalyMin, mid, spec.anomalyMax * 0.45, spec.anomalyMax],
      colors: ANOMALY_STOPS,
    };
  }
  return { domain: [0, 48, 100], colors: HAZARD_MAP[hazard].stops };
}

export function cssGradient(mode: ViewMode, hazard: HazardId): string {
  const { colors } = scaleStops(mode, hazard);
  return `linear-gradient(90deg, ${colors.join(", ")})`;
}

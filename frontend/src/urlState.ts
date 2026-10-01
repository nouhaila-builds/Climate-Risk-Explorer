import type { HazardId, ViewMode } from "./types";

export interface ExplorerQuery {
  region: string | null;
  hazard: HazardId;
  year: number;
  start: number;
  end: number;
  b0: number;
  b1: number;
  mode: ViewMode;
  compare: string[];
}

const HAZARDS = new Set<HazardId>(["heat", "drought", "flood", "precipitation", "wildfire", "storm"]);

function readYear(value: string | null, fallback: number, min = 1980, max = 2025): number {
  if (!value) return fallback;
  const year = Number(value);
  if (!Number.isInteger(year) || year < min || year > max) return fallback;
  return year;
}

export function parseExplorerQuery(params: URLSearchParams): Partial<ExplorerQuery> {
  const partial: Partial<ExplorerQuery> = {};
  const region = params.get("region");
  if (region) partial.region = region.toUpperCase();
  const hazard = params.get("hazard");
  if (hazard && HAZARDS.has(hazard as HazardId)) partial.hazard = hazard as HazardId;
  if (params.get("year")) partial.year = readYear(params.get("year"), 2025);
  if (params.get("start")) partial.start = readYear(params.get("start"), 2005);
  if (params.get("end")) partial.end = readYear(params.get("end"), 2025);
  if (params.get("b0")) partial.b0 = readYear(params.get("b0"), 1980);
  if (params.get("b1")) partial.b1 = readYear(params.get("b1"), 2000);
  const mode = params.get("mode");
  if (mode === "anomaly" || mode === "absolute") partial.mode = mode;
  const compare = params.get("compare");
  if (compare) {
    partial.compare = compare
      .split(",")
      .map((code) => code.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 4);
  }
  return partial;
}

export function serializeExplorerQuery(state: ExplorerQuery): string {
  const params = new URLSearchParams();
  if (state.region) params.set("region", state.region);
  params.set("hazard", state.hazard);
  params.set("year", String(state.year));
  params.set("start", String(state.start));
  params.set("end", String(state.end));
  params.set("b0", String(state.b0));
  params.set("b1", String(state.b1));
  if (state.mode === "anomaly") params.set("mode", "anomaly");
  if (state.compare.length) params.set("compare", state.compare.join(","));
  return params.toString();
}

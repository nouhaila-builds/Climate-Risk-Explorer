import { HAZARD_MAP, HAZARDS } from "./encoding";
import { associationPhrase, baselineSentence, directionWord, trendPhrase } from "./insights";
import {
  anomaly,
  baselineMean,
  coverageRatio,
  linearTrend,
  pearson,
  percentChange,
  percentileRank,
  periodMean,
  rollingMean,
  trendBand,
} from "./stats";
import type {
  AnnualSeries,
  Dataset,
  HazardId,
  Hotspot,
  MetricKey,
  MetricSummary,
  RegionProfile,
  SimEvent,
  TrendPoint,
  ViewMode,
} from "./types";

const RELATED: Record<HazardId, HazardId> = {
  heat: "drought",
  drought: "heat",
  flood: "precipitation",
  precipitation: "flood",
  wildfire: "drought",
  storm: "flood",
};

export function indexOfYear(years: number[], year: number): number {
  return years.indexOf(year);
}

function summarize(
  years: number[],
  values: (number | null)[],
  year: number,
  start: number,
  end: number,
  b0: number,
  b1: number,
  coverage: (number | null)[],
): MetricSummary {
  const recent = periodMean(years, values, start, end);
  const base = baselineMean(years, values, b0, b1);
  const index = indexOfYear(years, year);
  const current = index >= 0 && coverage[index] ? values[index] : null;
  return {
    current,
    periodMean: recent,
    baselineMean: base,
    anomaly: anomaly(recent, base),
    changePercent: percentChange(recent, base),
  };
}

export function buildProfile(
  dataset: Dataset,
  code: string,
  hazard: HazardId,
  year: number,
  start: number,
  end: number,
  b0: number,
  b1: number,
): RegionProfile | null {
  const series = dataset.series[code];
  if (!series) return null;
  const observed = dataset.years.filter((item, index) => item >= start && item <= end && series.coverage[index]);
  const spec = HAZARD_MAP[hazard];
  const focusValues = series[spec.detail];
  const windowYears = dataset.years.filter((item) => item >= start && item <= end);
  const windowValues = focusValues.filter((_, index) => dataset.years[index] >= start && dataset.years[index] <= end);
  const trend = linearTrend(windowYears, windowValues);
  const risks = Object.fromEntries(
    HAZARDS.map((item) => [item.id, periodMean(dataset.years, series[item.absolute], start, end)]),
  ) as Record<HazardId, number | null>;
  let warning: string | null = null;
  if (observed.length < 10) warning = "Small sample size — trend estimates are unstable.";
  else if (baselineMean(dataset.years, series.temperature, b0, b1) === null) {
    warning = "Historical baseline is incomplete for this selection.";
  }
  return {
    available: observed.length > 0,
    coverage: coverageRatio(series.coverage, dataset.years, start, end),
    sampleSize: observed.length,
    warning,
    risks,
    overall: periodMean(dataset.years, series.overall_risk, start, end),
    temperature: summarize(dataset.years, series.temperature, year, start, end, b0, b1, series.coverage),
    focus: summarize(dataset.years, focusValues, year, start, end, b0, b1, series.coverage),
    trend: {
      sufficient: trend.sufficient,
      slopePerYear: trend.slope,
      stderr: trend.stderr,
      n: trend.n,
      description: trendPhrase(trend.slope, trend.stderr, spec.detailUnit),
    },
  };
}

export function buildTrendPoints(
  years: number[],
  values: (number | null)[],
  start: number,
  end: number,
  b0: number,
  b1: number,
  fullReference: (number | null)[] = values,
): TrendPoint[] {
  const windowYears: number[] = [];
  const windowValues: (number | null)[] = [];
  years.forEach((year, index) => {
    if (year >= start && year <= end) {
      windowYears.push(year);
      windowValues.push(values[index]);
    }
  });
  const base = baselineMean(years, fullReference, b0, b1);
  const trend = linearTrend(windowYears, windowValues);
  const rolled = rollingMean(windowValues, 5);
  return windowYears.map((year, index) => {
    const value = windowValues[index];
    const band = value === null ? null : trendBand(trend, year);
    const fitted = trend.sufficient && trend.intercept !== null && trend.slope !== null
      ? trend.intercept + trend.slope * year
      : null;
    return {
      year,
      value,
      rolling: rolled[index],
      baseline: base,
      anomaly: anomaly(value, base),
      fitted,
      bandLow: band ? band[0] : null,
      bandHigh: band ? band[1] : null,
      percentile: percentileRank(value, fullReference),
    };
  });
}

export function mapReading(
  series: AnnualSeries,
  years: number[],
  hazard: HazardId,
  year: number,
  mode: ViewMode,
  b0: number,
  b1: number,
): number | null {
  const index = indexOfYear(years, year);
  if (index < 0 || !series.coverage[index]) return null;
  const spec = HAZARD_MAP[hazard];
  if (mode === "absolute") return series[spec.absolute][index];
  const source = series[spec.anomalySource];
  return anomaly(source[index], baselineMean(years, source, b0, b1));
}

export function globalMean(
  dataset: Dataset,
  metric: MetricKey,
  year: number,
): number | null {
  const index = indexOfYear(dataset.years, year);
  if (index < 0) return null;
  const sample: number[] = [];
  Object.values(dataset.series).forEach((series) => {
    const value = series[metric][index];
    if (value !== null && series.coverage[index]) sample.push(value);
  });
  if (!sample.length) return null;
  return sample.reduce((sum, value) => sum + value, 0) / sample.length;
}

export function globalSeries(dataset: Dataset, metric: MetricKey): (number | null)[] {
  return dataset.years.map((year) => globalMean(dataset, metric, year));
}

function anomalyScore(hazard: HazardId, delta: number | null): number {
  if (delta === null) return 0;
  if (hazard === "heat") return Math.max(0, Math.min(100, (delta / 2.5) * 100));
  if (hazard === "precipitation") return Math.max(0, Math.min(100, (delta / 250) * 100));
  return Math.max(0, Math.min(100, (delta / 30) * 100));
}

function trendScale(hazard: HazardId): number {
  if (hazard === "heat") return 0.06;
  if (hazard === "precipitation") return 8;
  return 0.8;
}

export function rankHotspots(
  dataset: Dataset,
  year: number,
  b0: number,
  b1: number,
  limit = 8,
): Hotspot[] {
  const index = indexOfYear(dataset.years, year);
  if (index < 0) return [];
  const rows: Hotspot[] = [];
  dataset.regions.forEach((region) => {
    const series = dataset.series[region.code];
    if (!series || !series.coverage[index]) return;
    let best: Hotspot | null = null;
    HAZARDS.forEach((hazard) => {
      const risk = series[hazard.absolute][index];
      if (risk === null) return;
      const source = series[hazard.anomalySource];
      const delta = anomaly(source[index], baselineMean(dataset.years, source, b0, b1));
      const trend = linearTrend(dataset.years.slice(0, index + 1), source.slice(0, index + 1));
      const slope = trend.sufficient ? trend.slope : null;
      const concurrent = HAZARDS.filter((item) => {
        const value = series[item.absolute][index];
        return value !== null && value >= 65;
      }).length;
      const aScore = anomalyScore(hazard.id, delta);
      const tScore = slope === null ? 0 : Math.max(0, Math.min(100, (slope / trendScale(hazard.id)) * 100));
      const score = 0.35 * risk + 0.25 * aScore + 0.25 * tScore + 0.15 * (concurrent / 6) * 100;
      const reasons: string[] = [];
      if (risk >= 70) reasons.push("high risk");
      if (aScore >= 60) reasons.push("above baseline");
      if (tScore >= 55) reasons.push("rapid increase");
      if (concurrent >= 3) reasons.push("multiple hazards");
      const row: Hotspot = {
        code: region.code,
        name: region.name,
        hazard: hazard.id,
        score,
        risk,
        anomaly: delta,
        reasons,
        latitude: region.latitude,
        longitude: region.longitude,
      };
      if (!best || row.score > best.score) best = row;
    });
    if (best) rows.push(best);
  });
  return rows.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function simulatedEvents(
  years: number[],
  values: (number | null)[],
  hazardLabel: string,
): SimEvent[] {
  const sample = values.filter((value): value is number => value !== null).sort((a, b) => a - b);
  if (sample.length < 8) return [];
  const cutoff = sample[Math.min(sample.length - 1, Math.floor(sample.length * 0.95))];
  const midpoint = sample[Math.floor(sample.length / 2)];
  if (cutoff <= midpoint) return [];
  const events: SimEvent[] = [];
  years.forEach((year, index) => {
    const value = values[index];
    if (value === null || value < cutoff) return;
    events.push({
      year,
      value,
      title: `Simulated extreme ${hazardLabel.toLowerCase()} year`,
      detail: "At or above the 95th percentile of this region's own simulated series. Not a named historical disaster.",
    });
  });
  return events;
}

export function storySteps(
  dataset: Dataset,
  code: string,
  hazard: HazardId,
  year: number,
  start: number,
  end: number,
  b0: number,
  b1: number,
  peakMonths: string[],
): { id: string; title: string; insight: string }[] {
  const region = dataset.regions.find((item) => item.code === code);
  const profile = buildProfile(dataset, code, hazard, year, start, end, b0, b1);
  if (!region || !profile) return [];
  const spec = HAZARD_MAP[hazard];
  const related = RELATED[hazard];
  const correlation = pearson(
    dataset.series[code][spec.absolute],
    dataset.series[code][HAZARD_MAP[related].absolute],
  );
  const events = simulatedEvents(dataset.years, dataset.series[code][spec.detail], spec.short)
    .filter((event) => event.year >= start && event.year <= end);
  return [
    {
      id: "pattern",
      title: "Where the signal sits",
      insight: `${region.name} has a ${spec.label.toLowerCase()} index of ${profile.risks[hazard] === null ? "no data" : profile.risks[hazard].toFixed(0)} for ${start}–${end}.`,
    },
    {
      id: "trend",
      title: "Long-term direction",
      insight: `${spec.label} in ${region.name} ${profile.trend.description}.`,
    },
    {
      id: "baseline",
      title: "Against the historical baseline",
      insight: baselineSentence(
        region.name,
        spec.label,
        profile.focus.changePercent,
        profile.focus.periodMean,
        profile.focus.baselineMean,
        spec.detailUnit,
        b0,
        b1,
      ),
    },
    {
      id: "seasonality",
      title: "Seasonal concentration",
      insight: peakMonths.length
        ? `The strongest months in this simulated series are ${peakMonths.join(", ")}.`
        : "Seasonal structure is unavailable for this selection.",
    },
    {
      id: "extremes",
      title: "Unusual years in the simulation",
      insight: `${events.length} simulated years reach the 95th percentile of ${region.name}'s own ${spec.label.toLowerCase()} series.`,
    },
    {
      id: "related",
      title: "Related hazard",
      insight: associationPhrase(correlation, spec.label.toLowerCase(), HAZARD_MAP[related].label.toLowerCase()),
    },
  ];
}

export function risingCount(dataset: Dataset, hazard: HazardId): number {
  const spec = HAZARD_MAP[hazard];
  return dataset.regions.filter((region) => {
    const series = dataset.series[region.code]?.[spec.detail];
    if (!series) return false;
    const trend = linearTrend(dataset.years, series);
    return directionWord(trend.slope, trend.stderr) === "up";
  }).length;
}

export { RELATED };

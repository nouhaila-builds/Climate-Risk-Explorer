/** Indicator math kept aligned with `src/climate_pipeline/indicators.py`. */

export function isMissing(value: number | null | undefined): value is null | undefined {
  return value === null || value === undefined || Number.isNaN(value);
}

export function baselineMean(
  years: number[],
  values: (number | null)[],
  start: number,
  end: number,
  minPoints = 5,
): number | null {
  if (start > end) return null;
  const sample: number[] = [];
  for (let index = 0; index < years.length; index += 1) {
    const value = values[index];
    if (years[index] >= start && years[index] <= end && !isMissing(value)) {
      sample.push(value);
    }
  }
  if (sample.length < minPoints) return null;
  return sample.reduce((sum, value) => sum + value, 0) / sample.length;
}

export function periodMean(
  years: number[],
  values: (number | null)[],
  start: number,
  end: number,
): number | null {
  return baselineMean(years, values, start, end, 1);
}

export function anomaly(value: number | null, baseline: number | null): number | null {
  if (isMissing(value) || isMissing(baseline)) return null;
  return value - baseline;
}

export function percentChange(recent: number | null, baseline: number | null): number | null {
  if (isMissing(recent) || isMissing(baseline) || baseline === 0) return null;
  return ((recent - baseline) / Math.abs(baseline)) * 100;
}

export function rollingMean(values: (number | null)[], window = 5): (number | null)[] {
  return values.map((_, index) => {
    if (index + 1 < window) return null;
    const slice = values.slice(index + 1 - window, index + 1);
    if (slice.some((value) => isMissing(value))) return null;
    return slice.reduce<number>((sum, value) => sum + (value ?? 0), 0) / window;
  });
}

export interface TrendFit {
  slope: number | null;
  intercept: number | null;
  stderr: number | null;
  sigma: number | null;
  n: number;
  sufficient: boolean;
  xMean: number | null;
  sxx: number | null;
}

export function linearTrend(years: number[], values: (number | null)[], minPoints = 8): TrendFit {
  const points: [number, number][] = [];
  for (let index = 0; index < years.length; index += 1) {
    const value = values[index];
    if (!isMissing(value)) points.push([years[index], value]);
  }
  const empty: TrendFit = {
    slope: null,
    intercept: null,
    stderr: null,
    sigma: null,
    n: points.length,
    sufficient: false,
    xMean: null,
    sxx: null,
  };
  if (points.length < minPoints) return empty;
  const n = points.length;
  const xMean = points.reduce((sum, [x]) => sum + x, 0) / n;
  const yMean = points.reduce((sum, [, y]) => sum + y, 0) / n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const [x, y] of points) {
    sxx += (x - xMean) ** 2;
    syy += (y - yMean) ** 2;
    sxy += (x - xMean) * (y - yMean);
  }
  if (sxx === 0) return empty;
  const slope = sxy / sxx;
  const intercept = yMean - slope * xMean;
  let residual = 0;
  for (const [x, y] of points) residual += (y - (intercept + slope * x)) ** 2;
  const sigma2 = residual / (n - 2);
  const sigma = Math.sqrt(sigma2);
  return {
    slope,
    intercept,
    stderr: Math.sqrt(sigma2 / sxx),
    sigma,
    n,
    sufficient: true,
    xMean,
    sxx,
  };
}

export function trendBand(trend: TrendFit, year: number, z = 1.96): [number, number] | null {
  if (!trend.sufficient || trend.sigma === null || trend.xMean === null || !trend.sxx || !trend.n) {
    return null;
  }
  const fitted = (trend.intercept ?? 0) + (trend.slope ?? 0) * year;
  const se = trend.sigma * Math.sqrt(1 / trend.n + (year - trend.xMean) ** 2 / trend.sxx);
  return [fitted - z * se, fitted + z * se];
}

export function percentileRank(value: number | null, reference: (number | null)[]): number | null {
  if (isMissing(value)) return null;
  const sample = reference.filter((item): item is number => !isMissing(item));
  if (sample.length < 8) return null;
  return (100 * sample.filter((item) => item <= value).length) / sample.length;
}

export function pearson(xs: (number | null)[], ys: (number | null)[]): number | null {
  const pairs: [number, number][] = [];
  for (let index = 0; index < xs.length; index += 1) {
    const x = xs[index];
    const y = ys[index];
    if (!isMissing(x) && !isMissing(y)) pairs.push([x, y]);
  }
  if (pairs.length < 8) return null;
  const n = pairs.length;
  const xMean = pairs.reduce((sum, [x]) => sum + x, 0) / n;
  const yMean = pairs.reduce((sum, [, y]) => sum + y, 0) / n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const [x, y] of pairs) {
    sxx += (x - xMean) ** 2;
    syy += (y - yMean) ** 2;
    sxy += (x - xMean) * (y - yMean);
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

export function coverageRatio(coverage: (number | null)[], years: number[], start: number, end: number): number | null {
  const sample: number[] = [];
  for (let index = 0; index < years.length; index += 1) {
    if (years[index] < start || years[index] > end) continue;
    const value = coverage[index];
    if (!isMissing(value)) sample.push(value);
  }
  if (!sample.length) return null;
  return sample.reduce((sum, value) => sum + value, 0) / sample.length;
}

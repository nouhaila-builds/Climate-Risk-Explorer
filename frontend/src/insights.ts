/** Narrative thresholds kept aligned with `climate_pipeline/insights.py`. */

export function changePhrase(percent: number | null): string {
  if (percent === null || Number.isNaN(percent)) {
    return "could not be compared with the baseline because the sample is incomplete";
  }
  if (percent >= 40) return "increased substantially";
  if (percent >= 10) return "increased";
  if (percent > -10) return "remained relatively stable";
  if (percent > -40) return "decreased";
  return "decreased substantially";
}

export function trendPhrase(slope: number | null, stderr: number | null, unit: string): string {
  if (slope === null || stderr === null) return "does not have a stable trend estimate";
  if (Math.abs(slope) <= 1.96 * stderr) return "shows no clear trend over the selected years";
  const perDecade = Math.abs(slope * 10);
  const direction = slope > 0 ? "increasing" : "decreasing";
  return `is ${direction} by about ${perDecade.toFixed(1)} ${unit} per decade`;
}

export function associationPhrase(correlation: number | null, left: string, right: string): string {
  if (correlation === null) {
    return `${left} and ${right} cannot be compared because the overlap is too short.`;
  }
  if (Math.abs(correlation) < 0.4) {
    return `In this simulated series, ${left} and ${right} do not show a strong linear association (r = ${correlation.toFixed(2)}).`;
  }
  const direction = correlation > 0 ? "move together" : "move in opposite directions";
  return `In this simulated series, ${left} and ${right} ${direction} (r = ${correlation.toFixed(2)}).`;
}

export function baselineSentence(
  region: string,
  metricLabel: string,
  percent: number | null,
  recent: number | null,
  baseline: number | null,
  unit: string,
  baselineStart: number,
  baselineEnd: number,
): string {
  const phrase = changePhrase(percent);
  if (recent === null || baseline === null || percent === null) {
    return `${metricLabel} in ${region} ${phrase} for the selected years against the ${baselineStart}–${baselineEnd} baseline.`;
  }
  const sign = percent > 0 ? "+" : "";
  return `${metricLabel} in ${region} ${phrase} relative to the ${baselineStart}–${baselineEnd} baseline (${recent.toFixed(1)} vs ${baseline.toFixed(1)} ${unit} per year, ${sign}${percent.toFixed(0)}%).`;
}

export function directionWord(slope: number | null, stderr: number | null): "up" | "down" | "flat" {
  if (slope === null || stderr === null || Math.abs(slope) <= 1.96 * stderr) return "flat";
  return slope > 0 ? "up" : "down";
}

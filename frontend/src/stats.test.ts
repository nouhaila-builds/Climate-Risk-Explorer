import { describe, expect, it } from "vitest";
import { changePhrase, trendPhrase } from "./insights";
import { anomaly, baselineMean, linearTrend, percentChange, rollingMean } from "./stats";
import { parseExplorerQuery, serializeExplorerQuery } from "./urlState";

describe("indicator parity", () => {
  it("keeps a short baseline missing", () => {
    const years = [1980, 1981, 1982, 1983];
    expect(baselineMean(years, [1, 2, 3, 4], 1980, 1983, 5)).toBeNull();
  });

  it("does not fill gaps with zero", () => {
    const rolled = rollingMean([1, 2, 3, 4, 5, null, 7], 5);
    expect(rolled[4]).toBeCloseTo(3);
    expect(rolled[5]).toBeNull();
    expect(anomaly(null, 5)).toBeNull();
    expect(percentChange(10, 0)).toBeNull();
  });

  it("fits an exact line", () => {
    const years = Array.from({ length: 12 }, (_, index) => 1980 + index);
    const values = years.map((year) => 2 * (year - 1980));
    const trend = linearTrend(years, values);
    expect(trend.slope).toBeCloseTo(2);
    expect(trend.stderr ?? 1).toBeLessThan(1e-8);
  });

  it("uses the same narrative buckets as the pipeline", () => {
    expect(changePhrase(83)).toContain("substantially");
    expect(changePhrase(0)).toBe("remained relatively stable");
    expect(changePhrase(null)).toContain("incomplete");
    expect(trendPhrase(0.2, 0.01, "days")).toContain("increasing");
    expect(trendPhrase(0.01, 0.05, "days")).toContain("no clear trend");
  });
});

describe("url state", () => {
  it("round-trips a shareable analysis", () => {
    const query = serializeExplorerQuery({
      region: "FRA",
      hazard: "heat",
      year: 2018,
      start: 2000,
      end: 2025,
      b0: 1980,
      b1: 2000,
      mode: "anomaly",
      compare: ["FRA", "ESP", "MAR"],
    });
    const parsed = parseExplorerQuery(new URLSearchParams(query));
    expect(parsed).toMatchObject({
      region: "FRA",
      hazard: "heat",
      year: 2018,
      start: 2000,
      end: 2025,
      b0: 1980,
      b1: 2000,
      mode: "anomaly",
      compare: ["FRA", "ESP", "MAR"],
    });
  });

  it("drops invalid hazards and keeps at most four regions", () => {
    const parsed = parseExplorerQuery(new URLSearchParams("hazard=hail&compare=a,b,c,d,e&year=1700"));
    expect(parsed.hazard).toBeUndefined();
    expect(parsed.year).toBe(2025);
    expect(parsed.compare).toHaveLength(4);
  });
});

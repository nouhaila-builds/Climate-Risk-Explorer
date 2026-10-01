import { useEffect, useRef } from "react";
import { curveCatmullRomClosed, lineRadial } from "d3-shape";
import { select } from "d3-selection";
import "d3-transition";
import { HAZARDS } from "../../encoding";
import { useReducedMotion } from "../../hooks/useMedia";
import type { HazardId } from "../../types";

interface FingerprintProps {
  risks: Record<HazardId, number | null> | null;
  center?: string | null;
  size?: number;
}

export function ClimateFingerprint({ risks, center, size = 250 }: FingerprintProps) {
  const ref = useRef<SVGSVGElement>(null);
  const previous = useRef<number[]>(HAZARDS.map(() => 0));
  const reduce = useReducedMotion();
  const values = HAZARDS.map((hazard) => (risks ? risks[hazard.id] : null));
  const signature = values.map((value) => (value === null ? "x" : value.toFixed(2))).join("|");

  useEffect(() => {
    const parsed = signature.split("|").map((item) => (item === "x" ? null : Number(item)));
    const missing = parsed.some((value) => value === null);
    const svg = select(ref.current);
    const radius = size / 2 - 36;
    const centerPoint = size / 2;
    svg.selectAll("*").remove();
    const root = svg.append("g").attr("transform", `translate(${centerPoint},${centerPoint})`);
    HAZARDS.forEach((hazard, index) => {
      const angle = -Math.PI / 2 + index * ((Math.PI * 2) / 6);
      root.append("line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", Math.cos(angle) * radius)
        .attr("y2", Math.sin(angle) * radius)
        .attr("stroke", "rgba(145,164,174,0.28)");
      root.append("text")
        .attr("x", Math.cos(angle) * (radius + 16))
        .attr("y", Math.sin(angle) * (radius + 16))
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("fill", "#91A4AE")
        .attr("font-size", 9)
        .attr("font-family", "IBM Plex Mono, monospace")
        .text(hazard.short.toUpperCase());
    });
    [0.5, 1].forEach((step) => {
      root.append("circle").attr("r", radius * step).attr("fill", "none").attr("stroke", "rgba(145,164,174,0.18)");
    });
    if (missing) {
      root.append("text").attr("text-anchor", "middle").attr("fill", "#91A4AE").attr("font-size", 11).text("NO DATA");
      return;
    }
    const next = parsed as number[];
    const from = previous.current.slice();
    const generator = lineRadial<number>()
      .angle((_, index) => index * ((Math.PI * 2) / 6))
      .radius((value) => (value / 100) * radius)
      .curve(curveCatmullRomClosed.alpha(0.5));
    const path = root.append("path")
      .attr("fill", "rgba(230,201,138,0.16)")
      .attr("stroke", "#E6C98A")
      .attr("stroke-width", 1.4)
      .attr("d", generator(from));
    if (reduce) path.attr("d", generator(next));
    else {
      path.transition().duration(520).attrTween("d", () => (t: number) => generator(from.map((value, index) => value + (next[index] - value) * t)) ?? "");
    }
    previous.current = next;
    root.append("text")
      .attr("text-anchor", "middle")
      .attr("fill", "#F2F6F8")
      .attr("font-family", "Space Grotesk, sans-serif")
      .attr("font-size", 22)
      .attr("dy", "0.3em")
      .text(center ?? "");
  }, [center, reduce, signature, size]);

  return <svg ref={ref} className="fingerprint" width={size} height={size} role="img" aria-label="Climate risk fingerprint" />;
}

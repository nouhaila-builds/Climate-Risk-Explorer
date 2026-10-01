import { useEffect, useRef, useState } from "react";
import { formatNumber, formatSigned } from "../../format";
import { useReducedMotion } from "../../hooks/useMedia";

interface FigureProps {
  value: number | null;
  digits?: number;
  suffix?: string;
  signed?: boolean;
  className?: string;
}

export function Figure({ value, digits = 0, suffix = "", signed = false, className }: FigureProps) {
  const reduce = useReducedMotion();
  const previous = useRef<number | null>(value);
  const [display, setDisplay] = useState<number | null>(value);

  useEffect(() => {
    if (value === null || reduce || previous.current === null) {
      previous.current = value;
      setDisplay(value);
      return;
    }
    const from = previous.current;
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / 420);
      const eased = 1 - (1 - t) ** 3;
      setDisplay(from + (value - from) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
      else previous.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduce]);

  const text = display === null
    ? "—"
    : signed
      ? formatSigned(display, digits, suffix)
      : `${formatNumber(display, digits)}${suffix}`;

  return (
    <span className={className} aria-label={value === null ? "No data available" : text}>
      {text}
    </span>
  );
}

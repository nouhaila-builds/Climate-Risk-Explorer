import { useEffect, useState } from "react";
import type { HazardId } from "../types";

export interface SeasonMonth {
  month: number;
  label: string;
  value: number | null;
}

export function useSeasonality(code: string | null, hazard: HazardId, start: number, end: number) {
  const [months, setMonths] = useState<SeasonMonth[] | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    if (!code) {
      setMonths(null);
      setStatus("idle");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    fetch(`/api/seasonality/${code}/${hazard}?start=${start}&end=${end}`)
      .then((response) => {
        if (!response.ok) throw new Error("missing");
        return response.json() as Promise<{ months: SeasonMonth[]; available?: boolean }>;
      })
      .then((body) => {
        if (cancelled) return;
        setMonths(body.months ?? null);
        setStatus(body.available === false ? "error" : "ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [code, hazard, start, end]);

  return { months, status };
}

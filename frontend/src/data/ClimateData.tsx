import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Dataset, RegionMeta } from "../types";

interface ClimateContextValue {
  status: "loading" | "ready" | "error";
  dataset: Dataset | null;
  byCode: Map<string, RegionMeta>;
  error: string | null;
  reload: () => void;
}

const ClimateContext = createContext<ClimateContextValue | null>(null);

export function ClimateDataProvider({ children }: { children: ReactNode }) {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [status, setStatus] = useState<ClimateContextValue["status"]>("loading");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    fetch("/api/bootstrap")
      .then((response) => {
        if (!response.ok) throw new Error(`API responded ${response.status}`);
        return response.json() as Promise<Dataset>;
      })
      .then((payload) => {
        if (cancelled) return;
        setDataset(payload);
        setStatus("ready");
        setError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("error");
        setError("The analytical API is not responding. Start it with uvicorn, then reload.");
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const byCode = useMemo(() => {
    const map = new Map<string, RegionMeta>();
    dataset?.regions.forEach((region) => map.set(region.code, region));
    return map;
  }, [dataset]);

  const value = useMemo<ClimateContextValue>(
    () => ({
      status,
      dataset,
      byCode,
      error,
      reload: () => setAttempt((item) => item + 1),
    }),
    [status, dataset, byCode, error],
  );

  return <ClimateContext.Provider value={value}>{children}</ClimateContext.Provider>;
}

export function useClimateData(): ClimateContextValue {
  const value = useContext(ClimateContext);
  if (!value) throw new Error("Climate data is unavailable outside the provider.");
  return value;
}

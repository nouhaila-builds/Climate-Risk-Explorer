import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { HazardId, ViewMode } from "./types";

export interface ExplorerState {
  region: string | null;
  hazard: HazardId;
  year: number;
  start: number;
  end: number;
  b0: number;
  b1: number;
  mode: ViewMode;
  compare: string[];
  playing: boolean;
  speed: 1 | 2 | 4;
  panelOpen: boolean;
  methodologyOpen: boolean;
  view: string;
  selectRegion: (code: string | null) => void;
  setHazard: (hazard: HazardId) => void;
  setYear: (year: number) => void;
  setPeriod: (start: number, end: number) => void;
  setBaseline: (b0: number, b1: number) => void;
  setMode: (mode: ViewMode) => void;
  togglePlay: () => void;
  setPlaying: (playing: boolean) => void;
  cycleSpeed: () => void;
  addCompare: (code: string) => void;
  removeCompare: (code: string) => void;
  focusHotspot: (code: string, hazard: HazardId) => void;
  setPanelOpen: (open: boolean) => void;
  setMethodologyOpen: (open: boolean) => void;
  setView: (view: string) => void;
  hydrate: (partial: Partial<ExplorerState>) => void;
}

function clamp(year: number): number {
  return Math.max(1980, Math.min(2025, Math.round(year)));
}

export const useExplorerStore = create<ExplorerState>()(
  subscribeWithSelector((set, get) => ({
    region: null,
    hazard: "heat",
    year: 2025,
    start: 2005,
    end: 2025,
    b0: 1980,
    b1: 2000,
    mode: "absolute",
    compare: [],
    playing: false,
    speed: 1,
    panelOpen: false,
    methodologyOpen: false,
    view: "/",
    selectRegion: (code) => set({ region: code, panelOpen: Boolean(code) }),
    setHazard: (hazard) => set({ hazard }),
    setYear: (year) => set({ year: clamp(year) }),
    setPeriod: (start, end) => {
      set({ start: clamp(Math.min(start, end)), end: clamp(Math.max(start, end)) });
    },
    setBaseline: (b0, b1) => set({ b0: clamp(Math.min(b0, b1)), b1: clamp(Math.max(b0, b1)) }),
    setMode: (mode) => set({ mode }),
    togglePlay: () => set({ playing: !get().playing }),
    setPlaying: (playing) => set({ playing }),
    cycleSpeed: () => set({ speed: get().speed === 1 ? 2 : get().speed === 2 ? 4 : 1 }),
    addCompare: (code) => {
      const compare = get().compare;
      if (compare.includes(code) || compare.length >= 4) return;
      set({ compare: [...compare, code] });
    },
    removeCompare: (code) => set({ compare: get().compare.filter((item) => item !== code) }),
    focusHotspot: (code, hazard) => set({ region: code, hazard, panelOpen: true }),
    setPanelOpen: (panelOpen) => set({ panelOpen }),
    setMethodologyOpen: (methodologyOpen) => set({ methodologyOpen }),
    setView: (view) => set({ view }),
    hydrate: (partial) => set(partial),
  })),
);

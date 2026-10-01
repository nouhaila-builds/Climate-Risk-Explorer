import { create } from "zustand";

interface HoverState {
  code: string | null;
  year: number | null;
  x: number;
  y: number;
  setHover: (patch: Partial<Omit<HoverState, "setHover">>) => void;
  clear: () => void;
}

export const useHoverStore = create<HoverState>((set) => ({
  code: null,
  year: null,
  x: 0,
  y: 0,
  setHover: (patch) => set(patch),
  clear: () => set({ code: null, year: null }),
}));

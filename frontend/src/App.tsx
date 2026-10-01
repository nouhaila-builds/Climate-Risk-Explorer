import { useEffect, useRef } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ClimateMap } from "./components/Map/ClimateMap";
import { ClimateTimeline } from "./components/Timeline/ClimateTimeline";
import { DetailPanel } from "./components/Layout/DetailPanel";
import { Header } from "./components/Layout/Header";
import { Methodology } from "./components/Layout/Methodology";
import { Navigation } from "./components/Layout/Navigation";
import { useClimateData } from "./data/ClimateData";
import { useMedia, useReducedMotion } from "./hooks/useMedia";
import { ComparePage } from "./pages/ComparePage";
import { ExplorePage } from "./pages/ExplorePage";
import { HazardsPage } from "./pages/HazardsPage";
import { HotspotsPage } from "./pages/HotspotsPage";
import { MapPage } from "./pages/MapPage";
import { MobileStory } from "./pages/MobileStory";
import { OverviewPage } from "./pages/OverviewPage";
import { TimelinePage } from "./pages/TimelinePage";
import { useExplorerStore } from "./store";
import { parseExplorerQuery, serializeExplorerQuery } from "./urlState";

const TIMELINE_VIEWS = new Set(["/", "/map", "/timeline", "/hazards", "/hotspots"]);

export function App() {
  const desktop = useMedia("(min-width: 1100px)");
  const { status, error, reload } = useClimateData();
  useUrlSync();
  usePlayback();
  useKeyboard();
  useViewSync();
  const panel = useExplorerStore((state) => state.panelOpen && Boolean(state.region));
  const view = useExplorerStore((state) => state.view);
  const navigate = useNavigate();

  useEffect(() => {
    const open = () => navigate("/explore");
    window.addEventListener("explorer:open-story", open);
    return () => window.removeEventListener("explorer:open-story", open);
  }, [navigate]);

  if (!desktop) return <MobileStory />;

  return (
    <div className={`shell ${panel && view !== "/compare" && view !== "/explore" ? "has-panel" : ""}`}>
      <Navigation />
      <main className="stage">
        <ClimateMap />
        <Header />
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/timeline" element={<TimelinePage />} />
          <Route path="/hazards" element={<HazardsPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/hotspots" element={<HotspotsPage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        {TIMELINE_VIEWS.has(view) && <ClimateTimeline />}
        <DetailPanel />
        <Methodology />
        {status === "error" && (
          <button className="map-skeleton" onClick={reload}>{error} Retry.</button>
        )}
      </main>
    </div>
  );
}

function useViewSync() {
  const location = useLocation();
  useEffect(() => {
    useExplorerStore.getState().setView(location.pathname);
    const titles: Record<string, string> = {
      "/": "Climate Risk Explorer",
      "/map": "Map · Climate Risk Explorer",
      "/timeline": "Timeline · Climate Risk Explorer",
      "/hazards": "Hazards · Climate Risk Explorer",
      "/compare": "Compare · Climate Risk Explorer",
      "/hotspots": "Hotspots · Climate Risk Explorer",
      "/explore": "Explore · Climate Risk Explorer",
    };
    document.title = titles[location.pathname] ?? "Climate Risk Explorer";
  }, [location.pathname]);
}

function useUrlSync() {
  const [, setParams] = useSearchParams();
  const ready = useRef(false);
  useEffect(() => {
    useExplorerStore.getState().hydrate(parseExplorerQuery(new URLSearchParams(window.location.search)));
    ready.current = true;
  }, []);
  useEffect(() => {
    return useExplorerStore.subscribe((state) => {
      if (!ready.current) return;
      const next = serializeExplorerQuery({
        region: state.region,
        hazard: state.hazard,
        year: state.year,
        start: state.start,
        end: state.end,
        b0: state.b0,
        b1: state.b1,
        mode: state.mode,
        compare: state.compare,
      });
      if (window.location.search.replace(/^\?/, "") !== next) {
        setParams(new URLSearchParams(next), { replace: true });
      }
    });
  }, [setParams]);
}

function usePlayback() {
  const playing = useExplorerStore((state) => state.playing);
  const speed = useExplorerStore((state) => state.speed);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!playing) return;
    const delay = reduce ? 900 : ({ 1: 780, 2: 420, 4: 220 } as const)[speed];
    const id = window.setInterval(() => {
      const { year, setYear } = useExplorerStore.getState();
      setYear(year >= 2025 ? 1980 : year + 1);
    }, delay);
    return () => window.clearInterval(id);
  }, [playing, speed, reduce]);
}

function useKeyboard() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const store = useExplorerStore.getState();
      if (event.key === "ArrowRight") {
        event.preventDefault();
        store.setYear(store.year + 1);
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        store.setYear(store.year - 1);
      }
      if (event.key === " ") {
        event.preventDefault();
        store.togglePlay();
      }
      if (event.key === "Escape") {
        store.setPanelOpen(false);
        store.setMethodologyOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

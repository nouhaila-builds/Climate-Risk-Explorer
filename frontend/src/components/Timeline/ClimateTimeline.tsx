import { useRef } from "react";
import { useExplorerStore } from "../../store";
import { PlaybackControls } from "./PlaybackControls";

const MIN = 1980;
const MAX = 2025;

function yearFromClient(clientX: number, rect: DOMRect): number {
  const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  return Math.round(MIN + ratio * (MAX - MIN));
}

export function ClimateTimeline() {
  const year = useExplorerStore((state) => state.year);
  const start = useExplorerStore((state) => state.start);
  const end = useExplorerStore((state) => state.end);
  const setYear = useExplorerStore((state) => state.setYear);
  const setPeriod = useExplorerStore((state) => state.setPeriod);
  const setPlaying = useExplorerStore((state) => state.setPlaying);
  const trackRef = useRef<HTMLDivElement>(null);

  const x = (value: number) => ((value - MIN) / (MAX - MIN)) * 100;
  const ticks = [1980, 1990, 2000, 2010, 2020, 2025];

  const drag = (mode: "year" | "start" | "end" | "pan", origin?: { x: number; start: number; end: number }) =>
    (event: React.PointerEvent) => {
      const track = trackRef.current;
      if (!track) return;
      setPlaying(false);
      const move = (point: PointerEvent) => {
        const rect = track.getBoundingClientRect();
        const next = yearFromClient(point.clientX, rect);
        if (mode === "year") setYear(next);
        if (mode === "start") setPeriod(Math.min(next, end - 1), end);
        if (mode === "end") setPeriod(start, Math.max(next, start + 1));
        if (mode === "pan" && origin) {
          const span = origin.end - origin.start;
          const shift = next - yearFromClient(origin.x, rect);
          const nextStart = Math.max(MIN, Math.min(MAX - span, origin.start + shift));
          setPeriod(nextStart, nextStart + span);
        }
      };
      move(event.nativeEvent);
      const up = (point: PointerEvent) => {
        move(point);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    };

  return (
    <div className="timeline-dock">
      <PlaybackControls />
      <div
        className="timeline"
        ref={trackRef}
        onPointerDown={drag("year")}
        role="slider"
        tabIndex={0}
        aria-label="Map year"
        aria-valuemin={MIN}
        aria-valuemax={MAX}
        aria-valuenow={year}
        aria-valuetext={`${year}, analysis window ${start} to ${end}`}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") setYear(year + 1);
          if (event.key === "ArrowLeft") setYear(year - 1);
          if (event.key === "Home") setYear(MIN);
          if (event.key === "End") setYear(MAX);
        }}
      >
        <svg viewBox="0 0 1000 78" preserveAspectRatio="none" aria-hidden="true">
          <line x1="0" y1="48" x2="1000" y2="48" stroke="rgba(145,164,174,0.35)" strokeWidth="1" />
          <rect
            x={(x(start) / 100) * 1000}
            y="44"
            width={((x(end) - x(start)) / 100) * 1000}
            height="8"
            fill="rgba(230,201,138,0.35)"
          />
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={(x(tick) / 100) * 1000} y1="42" x2={(x(tick) / 100) * 1000} y2="54" stroke="#91A4AE" strokeWidth="1" />
              <text x={(x(tick) / 100) * 1000} y="72" fill="#91A4AE" fontSize="12" textAnchor="middle" fontFamily="IBM Plex Mono, monospace">
                {tick}
              </text>
            </g>
          ))}
        </svg>
        <button
          aria-label="Move analysis window"
          onPointerDown={(event) => {
            event.stopPropagation();
            drag("pan", { x: event.clientX, start, end })(event);
          }}
          style={{ position: "absolute", left: `${x(start)}%`, width: `${x(end) - x(start)}%`, top: 36, height: 24, background: "transparent" }}
        />
        <button
          aria-label="Analysis start"
          onPointerDown={(event) => {
            event.stopPropagation();
            drag("start")(event);
          }}
          style={{ position: "absolute", left: `${x(start)}%`, top: 40, width: 12, height: 16, transform: "translateX(-50%)", background: "#E6C98A" }}
        />
        <button
          aria-label="Analysis end"
          onPointerDown={(event) => {
            event.stopPropagation();
            drag("end")(event);
          }}
          style={{ position: "absolute", left: `${x(end)}%`, top: 40, width: 12, height: 16, transform: "translateX(-50%)", background: "#E6C98A" }}
        />
        <button
          className="timeline-readout"
          style={{ left: `${x(year)}%` }}
          aria-label="Drag map year"
          onPointerDown={(event) => {
            event.stopPropagation();
            drag("year")(event);
          }}
        >
          {year}
        </button>
      </div>
    </div>
  );
}

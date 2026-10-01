import { Pause, Play } from "lucide-react";
import { useExplorerStore } from "../../store";

export function PlaybackControls() {
  const playing = useExplorerStore((state) => state.playing);
  const speed = useExplorerStore((state) => state.speed);
  const start = useExplorerStore((state) => state.start);
  const end = useExplorerStore((state) => state.end);
  const togglePlay = useExplorerStore((state) => state.togglePlay);
  const cycleSpeed = useExplorerStore((state) => state.cycleSpeed);
  return (
    <div className="playback">
      <div className="playback-row">
        <button className="play" onClick={togglePlay} aria-label={playing ? "Pause time" : "Play time"} aria-pressed={playing}>
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button className="speed" onClick={cycleSpeed} aria-label="Playback speed">
          {speed}×
        </button>
      </div>
      <p>{start} — {end}</p>
    </div>
  );
}

import type { SimEvent } from "../../types";

export function ExtremeEvents({ events }: { events: SimEvent[] }) {
  if (!events.length) return <p className="empty-state">No simulated year in this window reaches the 95th percentile.</p>;
  return (
    <div>
      <p className="kicker">Simulated extremes · not historical disasters</p>
      <ol className="event-list">
        {events.map((event) => (
          <li key={`${event.year}-${event.title}`}>
            <time dateTime={String(event.year)}>{event.year}</time>
            <div>
              <strong>{event.title}</strong>
              <p className="kicker">{event.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

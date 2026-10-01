import { BookOpen, Clock3, Compass, GitCompare, Globe, Layers, Radar } from "lucide-react";
import { NavLink } from "react-router-dom";

const ITEMS = [
  { to: "/", label: "Overview", icon: Compass, end: true },
  { to: "/map", label: "Map", icon: Globe, end: false },
  { to: "/timeline", label: "Timeline", icon: Clock3, end: false },
  { to: "/hazards", label: "Hazards", icon: Layers, end: false },
  { to: "/compare", label: "Compare", icon: GitCompare, end: false },
  { to: "/hotspots", label: "Hotspots", icon: Radar, end: false },
  { to: "/explore", label: "Explore", icon: BookOpen, end: false },
];

export function Navigation() {
  return (
    <nav className="rail" aria-label="Exploration">
      <div className="rail-mark" aria-hidden="true" />
      {ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink key={item.to} to={item.to} end={item.end} aria-label={item.label}>
            <Icon size={18} strokeWidth={1.5} />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

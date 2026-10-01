import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import type { Feature, FeatureCollection, LineString, Point } from "geojson";
import { mapReading, rankHotspots } from "../../analytics";
import { MapLegend } from "./MapLegend";
import { MapTooltip } from "./MapTooltip";
import { useClimateData } from "../../data/ClimateData";
import { scaleStops } from "../../encoding";
import { useHoverStore } from "../../hoverStore";
import { useReducedMotion } from "../../hooks/useMedia";
import { useExplorerStore } from "../../store";

function graticule(): FeatureCollection {
  const features: Feature<LineString | Point>[] = [];
  for (let lon = -180; lon <= 180; lon += 30) {
    const coordinates: [number, number][] = [];
    for (let lat = -80; lat <= 84; lat += 4) coordinates.push([lon, lat]);
    features.push({
      type: "Feature",
      properties: { kind: "meridian" },
      geometry: { type: "LineString", coordinates },
    });
  }
  for (let lat = -60; lat <= 80; lat += 30) {
    features.push({
      type: "Feature",
      properties: { kind: "parallel" },
      geometry: {
        type: "LineString",
        coordinates: [
          [-180, lat],
          [180, lat],
        ],
      },
    });
    features.push({
      type: "Feature",
      properties: { label: `${Math.abs(lat)}°${lat >= 0 ? "N" : "S"}` },
      geometry: { type: "Point", coordinates: [-168, lat] },
    });
  }
  return { type: "FeatureCollection", features };
}

function colorExpression(): maplibregl.ExpressionSpecification {
  const state = useExplorerStore.getState();
  if (state.view === "/hotspots") {
    return [
      "interpolate",
      ["linear"],
      ["coalesce", ["feature-state", "value"], 0],
      0, "#8FA8B3",
      55, "#C4A574",
      100, "#8E3B32",
    ] as maplibregl.ExpressionSpecification;
  }
  const { domain, colors } = scaleStops(state.mode, state.hazard);
  const stops: (string | number)[] = [];
  domain.forEach((value, index) => stops.push(value, colors[index]));
  return ["interpolate", ["linear"], ["coalesce", ["feature-state", "value"], 0], ...stops] as maplibregl.ExpressionSpecification;
}

export function ClimateMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { dataset, status } = useClimateData();
  const datasetRef = useRef(dataset);
  datasetRef.current = dataset;
  const reduce = useReducedMotion();
  const reduceRef = useRef(reduce);
  reduceRef.current = reduce;
  const refreshRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = new maplibregl.Map({
      container,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      minZoom: 1,
      maxZoom: 7.5,
      center: [10, 16],
      zoom: 1.4,
      style: {
        version: 8,
        glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
        sources: {},
        layers: [{ id: "ocean", type: "background", paint: { "background-color": "#07111A" } }],
      },
    });

    const displayed = new Map<string, number>();
    const codes: string[] = [];
    let frame = 0;
    let markers: maplibregl.Marker[] = [];
    const pattern = document.createElement("canvas");
    pattern.width = 8;
    pattern.height = 8;
    const context = pattern.getContext("2d");
    if (context) {
      context.strokeStyle = "rgba(145,164,174,0.45)";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(0, 8);
      context.lineTo(8, 0);
      context.stroke();
    }

    const paintScale = () => {
      if (!map.getLayer("countries")) return;
      map.setPaintProperty("countries", "fill-color", colorExpression());
    };

    const applySelection = () => {
      const region = useExplorerStore.getState().region;
      const hover = useHoverStore.getState().code;
      codes.forEach((code) => {
        map.setFeatureState(
          { source: "countries", id: code },
          {
            selected: code === region,
            dimmed: Boolean(region) && code !== region,
            hover: code === hover && code !== region,
          },
        );
      });
    };

    const readings = () => {
      const data = datasetRef.current;
      const values = new Map<string, number | null>();
      if (!data) return values;
      const state = useExplorerStore.getState();
      const mode = state.view === "/hotspots" ? "absolute" : state.mode;
      codes.forEach((code) => {
        const series = data.series[code];
        if (!series) {
          values.set(code, null);
          return;
        }
        if (state.view === "/hotspots") {
          const index = data.years.indexOf(state.year);
          values.set(code, index >= 0 && series.coverage[index] ? series.overall_risk[index] : null);
        } else {
          values.set(code, mapReading(series, data.years, state.hazard, state.year, mode, state.b0, state.b1));
        }
      });
      return values;
    };

    const applyValues = (next: Map<string, number | null>, duration: number) => {
      cancelAnimationFrame(frame);
      const from = new Map(displayed);
      const started = performance.now();
      const step = (now: number) => {
        const t = duration === 0 ? 1 : Math.min(1, (now - started) / duration);
        const eased = t * t * (3 - 2 * t);
        next.forEach((target, code) => {
          if (target === null) {
            displayed.delete(code);
            map.setFeatureState({ source: "countries", id: code }, { hasData: 0, value: 0 });
            return;
          }
          const origin = from.get(code);
          const value = origin === undefined ? target : origin + (target - origin) * eased;
          displayed.set(code, value);
          map.setFeatureState({ source: "countries", id: code }, { hasData: 1, value });
        });
        if (t < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    };

    const syncHotspots = () => {
      markers.forEach((marker) => marker.remove());
      markers = [];
      const data = datasetRef.current;
      const state = useExplorerStore.getState();
      if (!data || state.view !== "/hotspots") return;
      rankHotspots(data, state.year, state.b0, state.b1, 8).forEach((hotspot, index) => {
        const element = document.createElement("button");
        element.className = "hotspot-marker";
        element.style.animationDelay = `${index * 0.18}s`;
        element.setAttribute("aria-label", `${hotspot.name}, ${hotspot.hazard} hotspot`);
        element.addEventListener("click", (event) => {
          event.stopPropagation();
          useExplorerStore.getState().focusHotspot(hotspot.code, hotspot.hazard);
          window.dispatchEvent(new CustomEvent("explorer:open-story"));
        });
        const marker = new maplibregl.Marker({ element, anchor: "center" })
          .setLngLat([hotspot.longitude, hotspot.latitude])
          .addTo(map);
        marker.getElement().setAttribute("aria-label", `${hotspot.name}, ${hotspot.hazard} hotspot`);
        markers.push(marker);
      });
    };

    const focusRegion = (code: string | null) => {
      const region = code ? datasetRef.current?.regions.find((item) => item.code === code) : null;
      if (!region) return;
      const motion = reduceRef.current ? 0 : 900;
      map.flyTo({
        center: [region.longitude, region.latitude],
        zoom: Math.max(map.getZoom(), 3.4),
        duration: motion,
        essential: true,
      });
    };

    const refresh = () => {
      if (!map.getLayer("countries")) return;
      paintScale();
      applyValues(readings(), 0);
      applySelection();
      syncHotspots();
      focusRegion(useExplorerStore.getState().region);
    };
    refreshRef.current = refresh;

    map.on("load", () => {
      const image = context?.getImageData(0, 0, 8, 8);
      if (image) map.addImage("nodata-hatch", image, { pixelRatio: 2 });
      map.addSource("graticule", { type: "geojson", data: graticule() });
      map.addLayer({
        id: "graticule",
        type: "line",
        source: "graticule",
        filter: ["!=", ["geometry-type"], "Point"],
        paint: { "line-color": "rgba(145,164,174,0.16)", "line-width": 0.6 },
      });
      map.addLayer({
        id: "graticule-labels",
        type: "symbol",
        source: "graticule",
        filter: ["==", ["geometry-type"], "Point"],
        layout: {
          "text-field": ["get", "label"],
          "text-font": ["Open Sans Regular"],
          "text-size": 10,
        },
        paint: { "text-color": "#91A4AE", "text-opacity": 0.7 },
      });

      fetch("/geo/countries.json")
        .then((response) => response.json())
        .then((geojson: FeatureCollection) => {
          geojson.features.forEach((feature) => {
            const iso = feature.properties?.iso;
            if (typeof iso === "string") codes.push(iso);
          });
          map.addSource("countries", { type: "geojson", data: geojson, promoteId: "iso" });
          map.addLayer({
            id: "countries",
            type: "fill",
            source: "countries",
            paint: {
              "fill-color": colorExpression(),
              "fill-opacity": [
                "case",
                ["==", ["coalesce", ["feature-state", "hasData"], 0], 0],
                0,
                ["boolean", ["feature-state", "selected"], false],
                0.96,
                ["boolean", ["feature-state", "dimmed"], false],
                0.22,
                0.9,
              ],
            },
          });
          map.addLayer({
            id: "countries-missing",
            type: "fill",
            source: "countries",
            paint: {
              "fill-pattern": "nodata-hatch",
              "fill-opacity": ["case", ["==", ["coalesce", ["feature-state", "hasData"], 0], 0], 0.85, 0],
            },
          });
          map.addLayer({
            id: "countries-line",
            type: "line",
            source: "countries",
            paint: {
              "line-color": [
                "case",
                ["boolean", ["feature-state", "selected"], false],
                "#F4F7F8",
                ["boolean", ["feature-state", "hover"], false],
                "#D5DEE3",
                "rgba(7,17,26,0.85)",
              ],
              "line-width": [
                "case",
                ["boolean", ["feature-state", "selected"], false],
                1.5,
                ["boolean", ["feature-state", "hover"], false],
                1,
                0.4,
              ],
            },
          });
          refresh();
          map.fitBounds(
            [
              [-168, -52],
              [188, 78],
            ],
            { padding: { left: 96, right: 36, top: 120, bottom: 120 }, duration: 0 },
          );
        })
        .catch(() => undefined);
    });

    map.on("mousemove", "countries", (event) => {
      const iso = event.features?.[0]?.properties?.iso as string | undefined;
      if (!iso) return;
      map.getCanvas().style.cursor = "pointer";
      useHoverStore.getState().setHover({ code: iso, x: event.point.x, y: event.point.y });
      applySelection();
    });
    map.on("mouseleave", "countries", () => {
      map.getCanvas().style.cursor = "";
      useHoverStore.getState().setHover({ code: null });
      applySelection();
    });
    map.on("click", "countries", (event) => {
      const iso = event.features?.[0]?.properties?.iso as string | undefined;
      if (iso) useExplorerStore.getState().selectRegion(iso);
    });

    let previousYear = useExplorerStore.getState().year;
    const unsubscribe = useExplorerStore.subscribe((state, previous) => {
      if (!previous || !map.getLayer("countries")) return;
      const visualChange =
        state.year !== previous.year ||
        state.hazard !== previous.hazard ||
        state.mode !== previous.mode ||
        state.b0 !== previous.b0 ||
        state.b1 !== previous.b1 ||
        state.view !== previous.view;
      if (state.hazard !== previous.hazard || state.mode !== previous.mode || state.view !== previous.view) {
        paintScale();
      }
      if (visualChange) {
        const delta = Math.abs(state.year - previousYear);
        const duration = reduceRef.current || delta !== 1 ? 0 : state.playing ? 520 : 260;
        applyValues(readings(), duration);
        previousYear = state.year;
      }
      if (state.region !== previous.region) {
        applySelection();
        focusRegion(state.region);
      }
      if (state.view !== previous.view || state.year !== previous.year || state.b0 !== previous.b0 || state.b1 !== previous.b1) {
        syncHotspots();
      }
    });

    const onResize = () => map.resize();
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frame);
      unsubscribe();
      markers.forEach((marker) => marker.remove());
      window.removeEventListener("resize", onResize);
      map.remove();
    };
  }, []);

  useEffect(() => {
    if (!dataset) return;
    refreshRef.current?.();
    window.dispatchEvent(new Event("resize"));
  }, [dataset]);

  return (
    <div className={`map-frame ${status === "loading" ? "is-loading" : ""}`}>
      <div ref={containerRef} className="map-canvas" role="application" aria-label="World map of simulated climate risk" />
      {status === "loading" && <div className="map-skeleton">Preparing the geographic frame</div>}
      <MapTooltip />
      <MapLegend />
    </div>
  );
}

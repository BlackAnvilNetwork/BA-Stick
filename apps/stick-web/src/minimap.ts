import {
  FB_MAP_LABELS,
  FB_ROAD_NAMES,
  PH_MAP_LABELS,
  PH_ROAD_NAMES,
  ZONES,
  fieldById,
  forestBasinTrails,
  paleHollowTrails,
} from "@bellgrave/config";

/** Renderer label kinds (engine/ba-stick-render/src/minimap.rs `label`). */
export const MAP_LABEL_KIND = { area: 0, camp: 1, landmark: 2, water: 3 } as const;

export type MapData = {
  title: string;
  roads: { name: string; pts: Float32Array }[];
  labels: { text: string; x: number; z: number; kind: number }[];
};

/** Minimap roads and labels for a baked zone, from @bellgrave/config. */
export function mapDataFor(baked: string | null): MapData | null {
  if (baked === "pale_hollow") {
    return {
      title: ZONES.pale_hollow.name,
      roads: paleHollowTrails().map((t) => ({
        name: PH_ROAD_NAMES[t.id] ?? "",
        pts: Float32Array.from(t.points.flatMap((p) => [p.x, p.z])),
      })),
      labels: PH_MAP_LABELS.map((l) => ({ text: l.text, x: l.x, z: l.z, kind: MAP_LABEL_KIND[l.kind] })),
    };
  }
  if (baked === "forest_basin") {
    return {
      title: ZONES.forest_basin.name,
      roads: forestBasinTrails().map((t) => ({
        name: FB_ROAD_NAMES[t.id] ?? "",
        pts: Float32Array.from(t.points.flatMap((p) => [p.x, p.z])),
      })),
      labels: FB_MAP_LABELS.map((l) => ({ text: l.text, x: l.x, z: l.z, kind: MAP_LABEL_KIND[l.kind] })),
    };
  }
  const field = fieldById(baked);
  if (field && baked && baked in ZONES) {
    const kind = MAP_LABEL_KIND as Record<string, number>;
    return {
      title: ZONES[baked as keyof typeof ZONES].name,
      roads: field.trails().map((t) => ({
        name: field.roadNames[t.id] ?? "",
        pts: Float32Array.from(t.points.flatMap((p) => [p.x, p.z])),
      })),
      labels: field.labels.map((l) => ({ text: l.text, x: l.x, z: l.z, kind: kind[l.kind] ?? 0 })),
    };
  }
  return null;
}

type MapSink = {
  clearMapData(): void;
  setMapTitle(t: string): void;
  addMapRoad(name: string, pts: Float32Array): void;
  addMapLabel(text: string, x: number, z: number, kind: number): void;
};

/** Push map data into the renderer; it bakes the static layer once on the next draw. */
export function applyMapData(r: MapSink, baked: string | null): void {
  r.clearMapData();
  const d = mapDataFor(baked);
  if (!d) return;
  r.setMapTitle(d.title);
  for (const road of d.roads) r.addMapRoad(road.name, road.pts);
  for (const l of d.labels) r.addMapLabel(l.text, l.x, l.z, l.kind);
}

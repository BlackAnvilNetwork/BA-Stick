import { PH_MAP_LABELS, PH_ROAD_NAMES, paleHollowTrails, ZONES } from "@bellgrave/config";

/** Renderer label kinds (engine/ba-stick-render/src/minimap.rs `label`). */
export const MAP_LABEL_KIND = { area: 0, camp: 1, landmark: 2, water: 3 } as const;

export type MapData = {
  title: string;
  roads: { name: string; pts: Float32Array }[];
  labels: { text: string; x: number; z: number; kind: number }[];
};

/** Minimap roads and labels for a baked zone, from @bellgrave/config. */
export function mapDataFor(baked: string | null): MapData | null {
  if (baked !== "pale_hollow") return null;
  const title = (ZONES as Record<string, { name: string } | undefined>).pale_hollow?.name ?? "Pale Hollow";
  const roads = paleHollowTrails().map((t) => ({
    name: PH_ROAD_NAMES[t.id] ?? "",
    pts: Float32Array.from(t.points.flatMap((p) => [p.x, p.z])),
  }));
  const labels = PH_MAP_LABELS.map((l) => ({ text: l.text, x: l.x, z: l.z, kind: MAP_LABEL_KIND[l.kind] }));
  return { title, roads, labels };
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

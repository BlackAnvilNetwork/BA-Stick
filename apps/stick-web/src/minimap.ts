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

/** Where the engine should draw the HUD minimap this frame. */
export function shouldDrawHudMinimap(opts: {
  mapPane: boolean;
  hasWell: boolean;
  settingOn: boolean;
  full: boolean;
}): "full" | "dock" | "hide" {
  if (opts.full) return "full";
  if (opts.mapPane && opts.hasWell) return "dock";
  return "hide";
}

/** Clip a client-space well to framebuffer pixels. The engine skips a dock that hangs off the FB. */
export function clampMinimapDock(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  fw: number,
  fh: number,
): [number, number, number, number] | null {
  const x = Math.max(0, Math.round(Math.min(x0, x1)));
  const y = Math.max(0, Math.round(Math.min(y0, y1)));
  const w = Math.min(fw - x, Math.max(0, Math.round(Math.abs(x1 - x0))));
  const h = Math.min(fh - y, Math.max(0, Math.round(Math.abs(y1 - y0))));
  if (w < 16 || h < 16) return null;
  return [x, y, w, h];
}

/** Prefer the well box; if it collapsed, use the log frame under the header. */
export function minimapDockClientRect(
  well: { getBoundingClientRect(): DOMRect },
  frame: { getBoundingClientRect(): DOMRect; querySelector(sel: string): Element | null } | null,
): { left: number; top: number; right: number; bottom: number } {
  const box = well.getBoundingClientRect();
  if (box.width >= 24 && box.height >= 24) {
    return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
  }
  const fb = frame?.getBoundingClientRect();
  const head = frame?.querySelector(".hud-log-head")?.getBoundingClientRect();
  if (fb && head && fb.width >= 24) {
    return { left: fb.left, top: head.bottom, right: fb.right, bottom: fb.bottom };
  }
  return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
}

/** Copy the engine panel into the HUD well so cover-crop cannot hide it. */
export function blitMinimapToWell(
  src: CanvasImageSource,
  dest: HTMLCanvasElement,
  dock: [number, number, number, number],
): boolean {
  const [x, y, w, h] = dock;
  if (w < 16 || h < 16) return false;
  if (dest.width !== w || dest.height !== h) {
    dest.width = w;
    dest.height = h;
  }
  const ctx = dest.getContext("2d");
  if (!ctx) return false;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, x, y, w, h, 0, 0, w, h);
  return true;
}

/** Re-read the well box this often; it does not move with the camera. */
export const DOCK_REMEASURE_FRAMES = 12;

export function shouldRemeasureMinimapDock(framesSinceMeasure: number, paneJustOpened: boolean): boolean {
  return paneJustOpened || framesSinceMeasure >= DOCK_REMEASURE_FRAMES;
}

export function sameMinimapDock(
  a: [number, number, number, number] | null,
  b: [number, number, number, number] | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
}

export type MinimapBlitKey = {
  dock: [number, number, number, number];
  bakes: number;
  tx: number;
  ty: number;
  yawQ: number;
  marks: number;
};

/** Quantized panel contents: player cell, heading bucket, bake gen, nearby count. */
export function minimapBlitKey(
  dock: [number, number, number, number],
  bakes: number,
  cx: number,
  cz: number,
  yaw: number,
  marks: number,
): MinimapBlitKey {
  return {
    dock,
    bakes,
    tx: Math.round(cx),
    ty: Math.round(cz),
    yawQ: Math.round((yaw * 8) / Math.PI),
    marks,
  };
}

export function shouldBlitMinimap(prev: MinimapBlitKey | null, next: MinimapBlitKey): boolean {
  if (!prev) return true;
  return (
    prev.bakes !== next.bakes ||
    prev.tx !== next.tx ||
    prev.ty !== next.ty ||
    prev.yawQ !== next.yawQ ||
    prev.marks !== next.marks ||
    !sameMinimapDock(prev.dock, next.dock)
  );
}

/** Push map data into the renderer; it bakes the static layer once on the next draw. */
export function applyMapData(r: MapSink, baked: string | null): void {
  r.clearMapData();
  const d = mapDataFor(baked);
  if (!d) return;
  r.setMapTitle(d.title);
  for (const road of d.roads) r.addMapRoad(road.name, road.pts);
  for (const l of d.labels) r.addMapLabel(l.text, l.x, l.z, l.kind);
}

import { zoneRender } from "./zones";
import init, { StickRenderer } from "ba-stick-render";

export const FB_W = 640;
export const FB_H = 360;

let ready: Promise<unknown> | null = null;
/** Load the wasm module once. */
export function loadRenderer(): Promise<unknown> {
  ready ??= init();
  return ready;
}

export async function createRenderer(canvas: HTMLCanvasElement): Promise<StickRenderer> {
  await loadRenderer();
  return new StickRenderer(canvas, FB_W, FB_H);
}

/** Client pixel → framebuffer pixel for a `object-fit: contain` canvas. */
export function toFramebuffer(canvas: HTMLCanvasElement, clientX: number, clientY: number): [number, number] {
  const r = canvas.getBoundingClientRect();
  const scale = Math.min(r.width / FB_W, r.height / FB_H);
  const sx = (clientX - r.left - (r.width - FB_W * scale) / 2) / scale;
  const sy = (clientY - r.top - (r.height - FB_H * scale) / 2) / scale;
  return [sx, sy];
}

const zoneCache = new Map<string, Promise<Uint8Array>>();
/** Fetch a baked zone grid (public/zones/<id>.baz, made by scripts/bake-zones.ts). */
export function fetchZone(id: string): Promise<Uint8Array> {
  let p = zoneCache.get(id);
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}zones/${id}.baz`).then(async (res) => {
      if (!res.ok) throw new Error(`zone ${id}: HTTP ${res.status}`);
      return new Uint8Array(await res.arrayBuffer());
    });
    zoneCache.set(id, p);
  }
  return p;
}

const propCache = new Map<string, Promise<Uint8Array | null>>();
/** Fetch baked static props (public/zones/<id>.bap); null when the zone has none. */
export function fetchProps(id: string): Promise<Uint8Array | null> {
  let p = propCache.get(id);
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}zones/${id}.bap`).then(async (res) => (res.ok ? new Uint8Array(await res.arrayBuffer()) : null));
    propCache.set(id, p);
  }
  return p;
}

/** Server zone id → baked zone (see zones.ts). */
export function bakedZoneFor(zoneId: string | undefined): string | null {
  return zoneRender(zoneId).baked;
}

/** Framebuffer pixel → CSS px relative to the canvas box (inverse of toFramebuffer). */
export function fromFramebuffer(canvas: HTMLCanvasElement, fx: number, fy: number): [number, number] {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const scale = Math.min(w / FB_W, h / FB_H);
  return [(w - FB_W * scale) / 2 + fx * scale, (h - FB_H * scale) / 2 + fy * scale];
}

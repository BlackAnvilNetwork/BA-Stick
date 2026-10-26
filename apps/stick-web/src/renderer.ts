import { zoneRender } from "./zones";
import { WORLD_ZONE_IDS, zoneOrigin } from "@bellgrave/config";
import { FB_H, FB_W, fbFromClient, fbToClient, fitScale } from "./fit";
import init, { StickRenderer } from "ba-stick-render";

export { FB_H, FB_W } from "./fit";

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

/** Boot menu backdrop — match baked photo native size (crisp CSS upscale). */
export async function createBootRenderer(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): Promise<StickRenderer> {
  await loadRenderer();
  return new StickRenderer(canvas, width, height);
}

/** Client pixel → framebuffer pixel for an `object-fit: contain` or `cover` canvas. */
export function toFramebuffer(canvas: HTMLCanvasElement, clientX: number, clientY: number): [number, number] {
  const r = canvas.getBoundingClientRect();
  return fbFromClient(r, clientX, clientY, isCover(canvas));
}

function isCover(canvas: HTMLCanvasElement): boolean {
  return getComputedStyle(canvas).objectFit === "cover";
}

export function fbScale(canvas: HTMLCanvasElement): number {
  return fitScale(canvas.clientWidth, canvas.clientHeight, isCover(canvas));
}

const zoneCache = new Map<string, Promise<Uint8Array>>();
/** Fetch a baked zone grid (public/zones/<id>.baz, made by scripts/bake-zones.ts). */
export function fetchZone(id: string): Promise<Uint8Array> {
  let p = zoneCache.get(id);
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}zones/${id}.baz`).then(async (res) => {
      if (!res.ok) {
        zoneCache.delete(id);
        throw new Error(`zone ${id}: HTTP ${res.status}`);
      }
      return new Uint8Array(await res.arrayBuffer());
    });
    // Do not cache a failure: a transient error would otherwise stick until reload.
    p.catch(() => zoneCache.delete(id));
    zoneCache.set(id, p);
  }
  return p;
}

const propCache = new Map<string, Promise<Uint8Array | null>>();
/** Fetch baked static props (public/zones/<id>.bap); null when the zone has none. */
export function fetchProps(id: string): Promise<Uint8Array | null> {
  let p = propCache.get(id);
  if (!p) {
    // Props are optional: a network error means "no props", not a failed zone load.
    p = fetch(`${import.meta.env.BASE_URL}zones/${id}.bap`)
      .then(async (res) => (res.ok ? new Uint8Array(await res.arrayBuffer()) : null))
      .catch(() => {
        propCache.delete(id);
        return null;
      });
    propCache.set(id, p);
  }
  return p;
}

/** Server zone id → baked zone (see zones.ts). */
export function bakedZoneFor(zoneId: string | undefined): string | null {
  return zoneRender(zoneId).baked;
}

/**
 * Load every zone into the renderer at its world origin. Pale Hollow is placed
 * first so the Shard Dwellings are on screen while the other bakes finish.
 * A missing bake is skipped. Zones already placed stay.
 */
export async function placeAllZones(r: {
  placeZone(bytes: Uint8Array, ox: number, oz: number): void;
  placeProps(bytes: Uint8Array, ox: number, oz: number): number;
}): Promise<void> {
  const jobs = new Map(WORLD_ZONE_IDS.map((id) => [id, Promise.all([fetchZone(id), fetchProps(id)] as const)]));
  const place = async (id: string) => {
    try {
      const [baz, bap] = await jobs.get(id)!;
      const o = zoneOrigin(id);
      r.placeZone(baz, o.x, o.z);
      if (bap) r.placeProps(bap, o.x, o.z);
    } catch (err) {
      console.warn(`zone ${id} stayed offline`, err);
    }
  };
  await place("pale_hollow");
  await Promise.all(WORLD_ZONE_IDS.filter((id) => id !== "pale_hollow").map(place));
}

/** Framebuffer pixel → CSS px relative to the canvas box (inverse of toFramebuffer). */
export function fromFramebuffer(canvas: HTMLCanvasElement, fx: number, fy: number): [number, number] {
  return fbToClient(canvas.clientWidth, canvas.clientHeight, fx, fy, isCover(canvas));
}

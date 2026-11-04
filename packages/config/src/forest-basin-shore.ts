/**
 * Shore cleanup shared by the server and the zone bake, so a cell the bake
 * draws as water is water for walking too.
 *
 * On a 0.5 m grid it floods one-cell land juts and thin land bars between two
 * reaches of water (the meander spikes and dirt noses). A flooded cell takes
 * the LOWEST water level next to it, never a neighbour picked at random (that
 * could be the top of a fall face). Land is kept when it is content: an island,
 * a bridge abutment (bridges land on dry bank), or a real bar standing more
 * than KEEP_RISE above the water beside it.
 */
import { FB_BRIDGES, fbBridgeAt, fbDesignWater, fbIslandAt, fbOnFallFace } from "./forest-basin-features";

export const SHORE_CELL = 0.5;
/** Land standing this far above the adjacent water is a real bank, not a sliver. */
const KEEP_RISE = 1.0;
/** Widest land bar (cells) flooded when water lies on both sides: 3 m. */
const BAR_MAX = 6;
/** Bridge ends keep this much dry bank round them (m). */
const ABUTMENT_R = 3;
const NONE = -32768;

type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number };
type Fill = { minX: number; minZ: number; w: number; h: number; surf: Int16Array };

let fill: Fill | null = null;

const AROUND = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
  [-1, -1], [1, -1], [-1, 1], [1, 1],
] as const;

/** Pure: flood juts and thin bars in `surf` (water surface cm, NONE = land). */
export function shoreFillGrid(
  w: number, h: number, surf: Int16Array, groundCm: Int16Array, keep: Uint8Array,
): Int16Array {
  let cur = surf;
  const open = (g: Int16Array, i: number, j: number) => i >= 0 && j >= 0 && i < w && j < h && g[j * w + i]! !== NONE;
  const walk = (g: Int16Array, i: number, j: number, di: number, dj: number) => {
    for (let s = 1; s <= BAR_MAX; s++) if (open(g, i + di * s, j + dj * s)) return s;
    return BAR_MAX + 1;
  };
  for (let pass = 0; pass < 4; pass++) {
    const next = cur.slice();
    let changed = 0;
    for (let j = 1; j < h - 1; j++) {
      for (let i = 1; i < w - 1; i++) {
        const k = j * w + i;
        if (cur[k] !== NONE || keep[k]) continue;
        let low = Infinity, card = 0, all = 0;
        let l = false, r = false, u = false, d = false;
        for (const [di, dj] of AROUND) {
          if (!open(cur, i + di, j + dj)) continue;
          const y = cur[(j + dj) * w + i + di]!;
          if (y < low) low = y;
          all++;
          if (di === 0 || dj === 0) {
            card++;
            if (di < 0) l = true;
            if (di > 0) r = true;
            if (dj < 0) u = true;
            if (dj > 0) d = true;
          }
        }
        if (all === 0) continue;
        if (groundCm[k]! - low > KEEP_RISE * 100) continue;
        const jut = l && r || u && d || card >= 3 || (card >= 2 && all >= 4) || all >= 5;
        const bar = !jut && (
          walk(cur, i, j, -1, 0) + walk(cur, i, j, 1, 0) <= BAR_MAX ||
          walk(cur, i, j, 0, -1) + walk(cur, i, j, 0, 1) <= BAR_MAX ||
          walk(cur, i, j, -1, -1) + walk(cur, i, j, 1, 1) <= BAR_MAX ||
          walk(cur, i, j, -1, 1) + walk(cur, i, j, 1, -1) <= BAR_MAX);
        if (!jut && !bar) continue;
        next[k] = low;
        changed++;
      }
    }
    cur = next;
    if (!changed) break;
  }
  return cur;
}

function build(b: Bounds, ground: (x: number, z: number) => number): Fill {
  const c = SHORE_CELL;
  // Only the water's neighbourhood matters: find it on a 1 m scan, then pad.
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let z = b.minZ; z <= b.maxZ; z += 1) {
    for (let x = b.minX; x <= b.maxX; x += 1) {
      if (!fbDesignWater(x, z)) continue;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
    }
  }
  if (x0 > x1) return { minX: b.minX, minZ: b.minZ, w: 0, h: 0, surf: new Int16Array(0) };
  const minX = Math.max(b.minX, x0 - 4), minZ = Math.max(b.minZ, z0 - 4);
  const w = Math.round((Math.min(b.maxX, x1 + 4) - minX) / c) + 1;
  const h = Math.round((Math.min(b.maxZ, z1 + 4) - minZ) / c) + 1;
  const surf = new Int16Array(w * h).fill(NONE);
  const gcm = new Int16Array(w * h);
  const keep = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const x = minX + i * c, z = minZ + j * c, k = j * w + i;
      if (fbBridgeAt(x, z) || fbOnFallFace(x, z) || fbIslandAt(x, z)) { keep[k] = 1; continue; }
      for (const br of FB_BRIDGES) {
        if (Math.hypot(x - br.a.x, z - br.a.z) < ABUTMENT_R || Math.hypot(x - br.b.x, z - br.b.z) < ABUTMENT_R) keep[k] = 1;
      }
      const wd = fbDesignWater(x, z);
      if (wd) surf[k] = Math.round(wd.surface * 100);
      else gcm[k] = Math.round(ground(x, z) * 100);
    }
  }
  const out = shoreFillGrid(w, h, surf, gcm, keep);
  // Keep only the cells this pass added.
  for (let k = 0; k < out.length; k++) if (surf[k] !== NONE) out[k] = NONE;
  return { minX, minZ, w, h, surf: out };
}

/** Water surface (m) of a shore cell flooded by the cleanup, else null. */
export function fbShoreFillAt(x: number, z: number, b: Bounds, ground: (x: number, z: number) => number): number | null {
  if (!fill) fill = build(b, ground);
  const i = Math.round((x - fill.minX) / SHORE_CELL), j = Math.round((z - fill.minZ) / SHORE_CELL);
  if (i < 0 || j < 0 || i >= fill.w || j >= fill.h) return null;
  const v = fill.surf[j * fill.w + i]!;
  return v === NONE ? null : v / 100;
}

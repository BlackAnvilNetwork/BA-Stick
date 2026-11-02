// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Forest Basin target terrain for the scripted builder. The builder casts
 * Raise/Lower/Smooth/Paint/Block/Walk strokes until the live overlay matches
 * this plan. Water, bridges, ascents and places come from
 * `packages/config/src/forest-basin-features.ts`.
 */
import {
  FB_ASCENTS,
  FB_HEIGHTS,
  FB_PLACES,
  FB_RIVERS,
  FB_WARP_SITES,
  FOREST_BASIN_BOUNDS,
  fbAscentAt,
  fbBridgeAt,
  FB_BRIDGES,
  FB_BRIDGE_RAMP,
  fbBridgeDeckY,
  fbDesignWater,
  fbLakeSigned,
  fbIslandAt,
  fbIslandInset,
  FB_ISLANDS,
  FB_GORGES,
  FB_SINKS,
  FB_QUARRY,
  FB_POIS,
  fbRiverAt,
  fbTrailDist,
} from "@bellgrave/config";

const { minX, maxX, minZ, maxZ } = FOREST_BASIN_BOUNDS;

function hash(i: number, j: number): number {
  let h = (i * 374761393 + j * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x: number, z: number): number {
  const i = Math.floor(x), j = Math.floor(z);
  const fx = x - i, fz = z - j;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}
export function fbm(x: number, z: number): number {
  let s = 0, amp = 1, f = 1, n = 0;
  for (let o = 0; o < 4; o++) {
    s += amp * (vnoise(x * f, z * f) - 0.5);
    n += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return s / n; // about -0.5..0.5
}
const smooth = (a: number, b: number, t: number) => {
  const u = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return u * u * (3 - 2 * u);
};
const gauss = (x: number, z: number, cx: number, cz: number, r: number) => Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (r * r));

/** 0 below the Veil Scarp, 1 on the shelf above it. */
function veilScarp(x: number, z: number): number {
  const line = 115.6 + 0.7 * fbm(x / 6 + 3, 11) + 0.3 * Math.sin(x * 0.4);
  return smooth(line, line + 1.4, z) * (1 - smooth(-90, -85, x));
}

/** Big landforms only: bowl, fells, ridges, crag. */
export function macroHeight(x: number, z: number): number {
  const n = fbm(x / 38, z / 38);
  const fine = fbm(x / 9 + 40, z / 9 - 17);
  let h = 3.0 + 2.2 * n + 0.45 * fine;
  // The bowl: lowest toward the Stillmere, rising to the rim.
  h -= 1.4 * gauss(x, z, 80, 18, 70);
  const edge = Math.min(x - minX, maxX - x, z - minZ, maxZ - z) + 9 * fbm(x / 23 + 7, z / 23);
  h += 7.5 * (1 - smooth(4, 34, edge));
  // Graven Fells (north) and their quarry benches.
  const fell = smooth(78 + 10 * fbm(x / 40, 3), 140, z);
  h += 10.5 * fell;
  // West Ridge.
  h += 8.5 * smooth(-96 + 8 * fbm(z / 30, 9), -146, x);
  // Kiln Crag (east) and a shoulder toward the Swallow.
  h += 9.5 * gauss(x, z, 128, 58, 24) + 4 * gauss(x, z, 146, -30, 16);
  // Southern rise toward the Hollow Road lip, gentle.
  h += 2.0 * smooth(-90, -150, z);
  // The Veil Scarp: a 4 m rock step across the upper Briarwater valley. The river
  // leaves the upper shelf at the lip and falls to Fenstone Pool (the Wright's Veil).
  h += 4.0 * veilScarp(x, z);
  // Soft cap so the rim corners stay climbable-looking rather than spiking.
  if (h > 17) h = 17 + (h - 17) * 0.35;
  // Mesas for high places.
  for (const t of FB_HEIGHTS) {
    const d = Math.hypot(x - t.x, z - t.z);
    const top = t.y + 0.25 * fine;
    const wall = top - Math.max(0, d - t.r) * 0.9;
    if (wall > h) h = wall;
  }
  return h;
}

export type PlanCell = { h: number; cliff: boolean; walkForce: boolean; biome: "grass" | "meadow" | "mountain" | null };

/** Target ground height at (x,z), water beds and banks included. */
export function planHeight(x: number, z: number): number {
  let h = macroHeight(x, z);
  let levee = -Infinity; // banks hold the water: never below the surface beside it
  let shelf = h; // on the Veil shelf only the upper Briarwater cuts the banks
  // River valleys: banks fall toward the water and never sit below the surface.
  for (const r of FB_RIVERS) {
    for (let i = 0; i < r.points.length - 1; i++) {
      const a = r.points[i]!, b = r.points[i + 1]!;
      const vx = b.x - a.x, vz = b.z - a.z;
      const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (z - a.z) * vz) / (vx * vx + vz * vz)));
      const d = Math.hypot(x - (a.x + vx * t), z - (a.z + vz * t));
      const w = a.w + (b.w - a.w) * t;
      const s = a.y + (b.y - a.y) * t;
      if (d < w + 30) {
        const bank = s + 0.3 + Math.max(0, d - w) * (0.32 + 0.1 * fbm(x / 7, z / 7));
        if (bank < h) h = bank;
        if (Math.min(a.y, b.y) >= 15 && bank < shelf) shelf = bank;
        if (d < w + 8) levee = Math.max(levee, s + 0.25 - Math.max(0, d - w - 0.5) * 0.45);
      }
    }
  }
  const sc = veilScarp(x, z);
  if (sc > 0 && shelf > h) h = h + (shelf - h) * sc;
  const water = fbDesignWater(x, z);
  if (water) return water.surface - water.depth;
  if (levee > h) h = levee;
  // High places keep their tops: level within r, steep walls outside.
  for (const t of FB_HEIGHTS) {
    const d = Math.hypot(x - t.x, z - t.z);
    if (d <= t.r + 1.5 * fbm(x / 3, z / 3) + 1) return t.y + 0.2 * fbm(x / 4, z / 4);
  }
  // Islands: low humped tops above the lake.
  for (const isl of FB_ISLANDS) {
    if (fbIslandAt(x, z) && Math.hypot(x - isl.x, z - isl.z) < isl.r * 1.5) {
      // Shore at the waterline, rising gently inland: the shoals walk straight up.
      const t = Math.min(1, fbIslandInset(x, z) / 3);
      return 1.68 + (isl.top - 1.68) * t * t * (3 - 2 * t) + 0.1 * t * fbm(x / 3, z / 3);
    }
  }
  // Shore apron around the Stillmere.
  const outside = -fbLakeSigned(x, z);
  if (outside < 40) {
    const shore = 1.85 + outside * (0.2 + 0.08 * fbm(x / 8, z / 8)) + Math.max(0, outside - 14) * 0.6;
    if (shore < h) h = shore;
  }
  // The Graven Cuts: old quarry benches, each cut face a short cliff.
  {
    const q = FB_QUARRY;
    const d = Math.hypot(x - q.x, z - q.z) + 4 * fbm(x / 9, z / 9);
    if (d < q.r) {
      // worked down into the hill in benches about 3 m high, each a sheer cut face
      const rim = macroHeight(q.x, q.z) + 0.15;
      const tier = Math.min(3, Math.floor((q.r - d) / 4.5));
      const cut = rim - tier * q.bench + 0.1 * fbm(x / 4, z / 4);
      const t = smooth(q.r, q.r - 3, d);
      h = h + (cut - h) * t;
    }
  }
  // Sinkholes.
  for (const k of FB_SINKS) {
    const d = Math.hypot(x - k.x, z - k.z) / (k.r * (1 + 0.15 * fbm(x / 3, z / 3)));
    // Flat silt floor inside 0.62 r, a sheer drop to 0.85 r, then a crumbling lip.
    if (d > 0.95 && d < 1.3) h += 0.6 * Math.sin(((d - 0.95) / 0.35) * Math.PI); // rim berm
    if (d < 1) h -= k.depth * (d < 0.62 ? 1 : d < 0.85 ? 1 - 0.8 * smooth(0.62, 0.85, d) : 0.2 * (1 - smooth(0.85, 1, d)));
  }
  // The dip the Ashlin Aqueduct strides across: a dry hollow under the arches.
  {
    const ax = -57, az = 88, ux = 0.8, uz = 0.6; // run direction
    const along = (x - ax) * ux + (z - az) * uz, across = -(x - ax) * uz + (z - az) * ux;
    const r = Math.hypot(along / 9, across / 14) * (1 + 0.12 * fbm(x / 5, z / 5));
    if (r < 1) h -= 2.6 * (1 - smooth(0, 1, r));
  }
  // Built things settled into the land: a terrace cut for the Cold Forges with a bank behind,
  // footing mounds under the aqueduct piers and banked abutments at its ends, and earth
  // heaped against the old ruin walls.
  {
    const fx = -56, fz = 77.5, d = Math.hypot(x - fx, z - fz);
    const pad = macroHeight(fx, fz) - 0.3;
    if (d < 9) h = h + (pad - h) * (1 - smooth(6, 9, d));
    if (d > 5.5 && d < 8) h += 0.5 * Math.sin(((d - 5.5) / 2.5) * Math.PI); // berm round the terrace
  }
  for (let k = -3; k <= 3; k++) for (const side of [-1, 1]) {
    const px = -57 + k * 4 + side * 2.5 * 0.8, pz = 88 + k * 3 + side * 2.5 * 0.6;
    h += 0.7 * gauss(x, z, px, pz, 1.6);
  }
  for (const k of [-3.9, 3.9]) h += 1.6 * gauss(x, z, -57 + k * 4, 88 + k * 3, 3.2);
  // rock cheeks either side of the Wright's Veil, standing out of the scarp
  h += 2.6 * gauss(x, z, -97.6, 117.6, 2.0) + 2.0 * gauss(x, z, -89.4, 117.0, 1.8);
  for (const r of FB_POIS) {
    if (r.kind !== "ruin") continue;
    const d = Math.hypot(x - r.x, z - r.z);
    if (d < 5.2) h += 0.55 * Math.max(0, 1 - Math.abs(d - 3.5) / 1.4) - 0.15 * Math.max(0, 1 - d / 2.5);
  }
  // Gorges: steep-walled cuts, floor rising out of the open mouth.
  for (const g of FB_GORGES) {
    const p = g.points;
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i]!, b = p[i + 1]!;
      const vx = b.x - a.x, vz = b.z - a.z;
      const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (z - a.z) * vz) / (vx * vx + vz * vz)));
      const d = Math.hypot(x - (a.x + vx * t), z - (a.z + vz * t));
      const along = (i + t) / (p.length - 1);
      const depth = g.depth * (along < 0.08 ? along / 0.08 : along > 0.8 ? (1 - along) / 0.2 : 1);
      const w = g.halfWidth * (1 + 0.25 * fbm(x / 6, z / 6));
      if (d < w + 2.5) {
        const floor = macroHeight(x, z) - depth;
        const wall = floor + Math.max(0, d - w) * 5;
        if (wall < h) h = wall;
      }
    }
  }
  // Ascents: carve the route into the cliff (stairs step, ledges grade, clefts cut).
  const asc = fbAscentAt(x, z);
  if (asc && asc.dist <= asc.ascent.halfWidth) {
    const y = asc.ascent.kind === "stair" ? Math.round(asc.y / 0.45) * 0.45 : asc.y;
    return y;
  }
  if (asc && asc.ascent.kind === "cleft") return Math.max(h, asc.y + 3.5); // crag walls either side
  // Bridges: solid abutments under the dry part of each ramp (deck - 0.1), and an
  // embankment beyond each end that eases from the bank height down to the ground
  // (grade 0.35), so deck ends sit on the bank and the approach has no step.
  for (const b of FB_BRIDGES) {
    const L = Math.hypot(b.b.x - b.a.x, b.b.z - b.a.z);
    const ux = (b.b.x - b.a.x) / L, uz = (b.b.z - b.a.z) / L;
    const along = (x - b.a.x) * ux + (z - b.a.z) * uz;
    const side = Math.abs((x - b.a.x) * uz - (z - b.a.z) * ux);
    if (side > b.halfWidth + 3) continue;
    const lat = side <= b.halfWidth + 0.5 ? 1 : 1 - (side - b.halfWidth - 0.5) / 2.5;
    if (along >= 0 && along <= L) {
      if (fbDesignWater(x, z) != null) continue;
      const t = along / L;
      if (t > FB_BRIDGE_RAMP && t < 1 - FB_BRIDGE_RAMP) continue; // gorge stays open under mid-span
      const deck = fbBridgeDeckY(b, t) - 0.1;
      if (deck > h && deck - h < 1.2) h = h + (deck - h) * lat; // ease the bank lip, never fill a drop
      continue;
    }
    const out = along < 0 ? -along : along - L;
    const yEnd = along < 0 ? b.yA : b.yB;
    if (out > 9) continue;
    const want = yEnd - 0.1 - out * 0.35;
    // fill a low approach up, cut a high one down, fading out over the embankment
    const k = lat * Math.max(0, 1 - out / 9);
    h = h + (Math.max(want, Math.min(h, yEnd - 0.1 + out * 0.35)) - h) * k;
  }
  // Ring floors and camp: gently levelled, not flat.
  for (const w of FB_WARP_SITES) {
    const d = Math.hypot(x - w.x, z - w.z);
    if (d < 7) h = h + (macroHeight(w.x, w.z) - h) * (1 - d / 7) * 0.8;
  }
  // Trails ease the cross-slope.
  const td = fbTrailDist(x, z);
  if (td < 2.5) h -= 0.12 * (1 - td / 2.5);
  return h;
}

export function planCell(x: number, z: number, slope: number): PlanCell {
  const h = planHeight(x, z);
  const asc = fbAscentAt(x, z);
  const onRoute = (asc != null && asc.dist <= asc.ascent.halfWidth) || fbBridgeAt(x, z) != null || fbTrailDist(x, z) < 2;
  const wet = fbDesignWater(x, z) != null;
  const cliff = !wet && !onRoute && slope > 0.85;
  let biome: PlanCell["biome"] = null;
  if (cliff) biome = "mountain";
  else if (!wet) {
    const glade = fbm(x / 26 + 91, z / 26 - 33);
    const nearPlace = FB_PLACES.some((p) => Math.hypot(x - p.x, z - p.z) < 9 + 4 * fbm(x / 5, z / 5));
    biome = glade > 0.17 || nearPlace || h > 10.5 ? "meadow" : "grass";
  }
  return { h, cliff, walkForce: onRoute && !wet, biome };
}

/** Plan sampled on a grid (step m), with slope from central differences. */
export function planGrid(step: number): { w: number; hgt: Float32Array; cells: PlanCell[] } {
  const w = Math.round((maxX - minX) / step) + 1;
  const hgt = new Float32Array(w * w);
  for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) hgt[j * w + i] = planHeight(minX + i * step, minZ + j * step);
  const cells: PlanCell[] = [];
  for (let j = 0; j < w; j++) {
    for (let i = 0; i < w; i++) {
      const gx = (hgt[j * w + Math.min(w - 1, i + 1)]! - hgt[j * w + Math.max(0, i - 1)]!) / (2 * step);
      const gz = (hgt[Math.min(w - 1, j + 1) * w + i]! - hgt[Math.max(0, j - 1) * w + i]!) / (2 * step);
      cells.push(planCell(minX + i * step, minZ + j * step, Math.hypot(gx, gz)));
    }
  }
  return { w, hgt, cells };
}

export { FB_ASCENTS };

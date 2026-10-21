/**
 * Pale Hollow static props for ba-stick-render, placed exactly like the old
 * client (the retired apps/web/src/PaleHollowMap.tsx): hub encampment coordinates, the
 * deterministic `WorldTrees` and `placeClutterInChunk` scatter (same hash2,
 * same grids, same biome rules), rock wall blocks and mountain peaks.
 *
 * Output "BAP1": magic[4] | u32 n | n × { u8 kind | u8 var | f32 x z y yaw s w h d } (LE).
 */
import {
  PH_HUB,
  PH_MOUNTAINS,
  PH_STORAGE_CHEST,
  paleHollowBiome,
  paleHollowHeight,
  paleHollowInBuildingClearing,
  paleHollowInOpenWater,
  paleHollowStandHeight,
  PH_BRIDGE_DECK_W,
  PH_BRIDGE_SITES,
  PH_RIVER_MAIN,
  PH_RIVER_TRIB,
  PH_RIVER_WALL,
  paleHollowBankPoint,
  paleHollowBridgeGeom,
  paleHollowBridgeDeckY,
  paleHollowInBridgeWallVisualGap,
  paleHollowRiverCenterX,
  paleHollowTributaryCenterX,
  paleHollowTerrainMeshY,
  paleHollowWaterSurfaceY,
  type PaleHollowRiverKind,
} from "@bellgrave/config";

/** Must match `PropKind` in engine/ba-stick-render/src/props.rs. */
export const K = {
  pine: 0, spruce: 1, cypress: 2, ashMed: 3, ashTall: 4,
  longGrass: 10, tallPatch: 11, fern: 12, tuft: 13, bush: 14, rock: 15, stalk: 16, reed: 17, scrub: 18, bloom: 19, sapling: 20,
  wallBlock: 30, moss: 31, firePit: 32, tent: 33, bedroll: 34, crate: 35, chest: 36, leanTo: 37, trainer: 38, stall: 39,
  weaponRack: 40, firewood: 41, barrel: 42, banner: 43, stone: 44, pebble: 45, peak: 46, riverWall: 47, bridge: 48,
} as const;

export type Prop = { kind: number; v: number; x: number; z: number; y: number; yaw: number; s: number; w: number; h: number; d: number };

export function hash2(i: number, j: number): number {
  const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function peakRockScale(h: number): number {
  return Math.max(0.7, h / 8);
}
function coneRadiusAtOffset(baseR: number, height: number, centerAbove: number): number {
  const half = height * 0.5;
  const t = (-centerAbove + half) / Math.max(height, 1e-4);
  return baseR * (1 - Math.max(0, Math.min(1, t)));
}
function treeInsidePeakRock(x: number, z: number): boolean {
  for (const m of PH_MOUNTAINS) {
    if (m.z <= -8) continue;
    const scale = peakRockScale(m.h);
    const dx = x - m.x, dz = z - m.z;
    const mainR = coneRadiusAtOffset(5.2 * scale, 7.2 * scale, -1.2 + 2.4 * scale) + 0.35;
    if (dx * dx + dz * dz < mainR * mainR) return true;
    const sideR = coneRadiusAtOffset(2.8 * scale, 4.2 * scale, -1.2 + 1.3 * scale) + 0.25;
    const dx2 = dx - 2.4 * scale, dz2 = dz - 1.6 * scale;
    if (dx2 * dx2 + dz2 * dz2 < sideR * sideR) return true;
  }
  return false;
}

function trees(out: Prop[]): void {
  const blocked = (x: number, z: number) => {
    const b = paleHollowBiome(x, z);
    if (b === "river" || b === "hub_indoor" || b === "bridge" || b === "ash_road") return true;
    return paleHollowInOpenWater(x, z) || paleHollowInBuildingClearing(x, z) || treeInsidePeakRock(x, z);
  };
  const push = (x: number, z: number, kind: number, height: number) => {
    if (blocked(x, z)) return;
    out.push({ kind, v: 0, x, z, y: paleHollowHeight(x, z), yaw: hash2(x * 7, z * 7) * Math.PI * 2, s: height, w: 0, h: 0, d: 0 });
  };
  for (let ix = -78; ix <= 78; ix += 7.5) {
    for (let iz = 10; iz <= 245; iz += 8.5) {
      const jx = ix + (hash2(ix, iz) - 0.5) * 5.5;
      const jz = iz + (hash2(iz, ix) - 0.5) * 5.5;
      if (blocked(jx, jz)) continue;
      const b = paleHollowBiome(jx, jz);
      const h = hash2(Math.floor(jx * 2), Math.floor(jz * 2));
      const h2 = hash2(Math.floor(jz * 3), Math.floor(jx * 3));
      if (b === "riverbank" && h > 0.35) {
        if (h2 > 0.55) push(jx, jz, K.ashTall, 4.6 + h * 1.2);
        else push(jx, jz, K.ashMed, 3.4 + h * 0.9);
        continue;
      }
      if (b === "grass" || b === "meadow" || (b === "farm" && h > 0.7)) {
        if (h < 0.42) continue;
        if (h2 > 0.5) push(jx, jz, K.pine, 3.8 + h * 1.3);
        else push(jx, jz, K.spruce, 3.5 + h * 1.1);
        continue;
      }
      if (b === "mountain" || b === "quarry") {
        if (h < 0.4) continue;
        push(jx, jz, K.cypress, 4.2 + h * 1.6);
        continue;
      }
      if (b === "scrub" && h > 0.72) {
        if (PH_MOUNTAINS.some((m) => Math.hypot(jx - m.x, jz - m.z) < m.r * 1.15)) push(jx, jz, K.cypress, 3.8 + h * 1.2);
      }
    }
  }
}

const CLUTTER_IX0 = -82, CLUTTER_IZ0 = 6, CLUTTER_IX_STEP = 3.9, CLUTTER_IZ_STEP = 4.1, CLUTTER_IX_MAX = 82, CLUTTER_IZ_MAX = 252;

function clutter(out: Prop[]): void {
  const push = (kind: number, x: number, z: number, s: number, salt = 0, v = 0) => {
    const hx = hash2(Math.floor(x * 13 + salt), Math.floor(z * 17));
    const hz = hash2(Math.floor(z * 19 + salt), Math.floor(x * 23));
    const hs = hash2(Math.floor(x * 29 + salt * 3), Math.floor(z * 31));
    const px = x + (hx - 0.5) * 0.85, pz = z + (hz - 0.5) * 0.85;
    out.push({ kind, v, x: px, z: pz, y: paleHollowHeight(x, z), yaw: (hx - 0.5) * 6.28, s: s * (0.78 + hs * 0.55), w: 0.82 + hz * 0.45, h: 0, d: 0 });
  };
  const pushVariant = (kind: number, x: number, z: number, s: number, salt = 0) => {
    const pick = hash2(Math.floor(x * 41 + salt), Math.floor(z * 43));
    push(kind, x, z, s, salt, pick > 0.48 ? 1 : 0);
  };
  for (let iz = CLUTTER_IZ0; iz <= CLUTTER_IZ_MAX; iz += CLUTTER_IZ_STEP) {
    for (let ix = CLUTTER_IX0; ix <= CLUTTER_IX_MAX; ix += CLUTTER_IX_STEP) {
      const jx = ix + (hash2(ix, iz) - 0.5) * 3.2;
      const jz = iz + (hash2(iz, ix) - 0.5) * 3.2;
      const b = paleHollowBiome(jx, jz);
      if (b === "hub_indoor" || b === "river" || b === "bridge" || b === "ash_road") continue;
      if (paleHollowInOpenWater(jx, jz) || paleHollowInBuildingClearing(jx, jz)) continue;
      const h = hash2(Math.floor(jx * 3), Math.floor(jz * 3));
      const h2 = hash2(Math.floor(jz * 5), Math.floor(jx * 5));
      const h3 = hash2(Math.floor(jx * 7), Math.floor(jz * 11));
      if (h3 < 0.32) continue;
      const grassy = b === "grass" || b === "meadow" || b === "farm" || b === "ashbeam" || b === "scrub" || b === "riverbank";
      if (grassy && h > 0.18) {
        const s = 0.85 + h * 1.05;
        if (h2 > 0.42) pushVariant(K.longGrass, jx, jz, s, 1);
        else pushVariant(K.tallPatch, jx, jz, s * 1.05, 2);
        if (h > 0.72 && h2 > 0.55) pushVariant(K.longGrass, jx + (h2 - 0.5) * 2.4, jz + (h3 - 0.5) * 2.2, 0.65 + h * 0.55, 3);
      }
      if ((b === "ashbeam" || b === "meadow" || b === "grass") && h > 0.55 && h2 > 0.45) pushVariant(K.fern, jx + (h - 0.5) * 1.2, jz + (h2 - 0.5) * 1.2, 0.9 + h * 0.7, 4);
      if (grassy && h > 0.88 && h2 > 0.75) push(K.tuft, jx + (h3 - 0.5) * 1.5, jz + (h - 0.5) * 1.5, 0.4 + h * 0.25, 5);
      if (b === "farm" && h > 0.28) {
        push(K.stalk, jx + (h2 - 0.5) * 1.4, jz + (h3 - 0.5) * 1.2, 0.95 + h * 0.75, 6);
        if (h2 > 0.55) push(K.stalk, jx - 0.9 + h3, jz + 0.7 - h, 0.8 + h * 0.5, 7);
      }
      if (b === "riverbank" && h > 0.22) {
        push(K.reed, jx, jz, 1.1 + h * 0.95, 8);
        if (h2 > 0.5) push(K.reed, jx + 0.7 + (h - 0.5), jz - 0.5 + (h3 - 0.5), 0.85 + h * 0.55, 9);
      }
      if (b === "scrub" && h > 0.35) pushVariant(K.scrub, jx, jz, 0.75 + h * 0.55, 10);
      if ((b === "meadow" || b === "grass") && h > 0.9 && h2 > 0.85) push(K.bloom, jx + (h3 - 0.5) * 0.8, jz + (h - 0.5) * 0.8, 0.4 + h * 0.15, 11);
      if ((b === "grass" || b === "meadow" || b === "ashbeam") && h > 0.72) pushVariant(K.bush, jx + (h2 - 0.5) * 1.6, jz + (h3 - 0.5) * 1.6, 0.8 + h * 0.5, 12);
      if (b === "ashbeam" && h > 0.55 && h2 > 0.4) push(K.sapling, jx + (h3 - 0.5) * 1.1, jz + (h - 0.5) * 1.1, 1.1 + h * 0.55, 13);
      if (b === "mountain" || b === "quarry" || (b === "riverbank" && h > 0.85)) {
        if (h2 > 0.5) pushVariant(K.rock, jx, jz, 0.4 + h * 0.55, 14);
      }
    }
  }
}

function hub(out: Prop[]): void {
  const y0 = PH_HUB.floorY;
  const p = (kind: number, x: number, z: number, yaw = 0, s = 1, w = 0, h = 0, d = 0, v = 0, y = y0) =>
    out.push({ kind, v, x, z, y, yaw, s, w, h, d });
  // HubRearRockWall blocks [x, z, w, h, d, yaw]
  const wall: [number, number, number, number, number, number][] = [
    [-7.5, 8.6, 2.8, 1.9, 1.4, 0.2], [-5.2, 9.1, 3.4, 2.4, 1.8, -0.15], [-2.4, 9.4, 4.2, 2.8, 2.1, 0.08],
    [0.3, 9.5, 3.8, 2.6, 2.0, 0], [3.0, 9.2, 3.6, 2.5, 1.9, -0.1], [5.6, 8.7, 3.0, 2.1, 1.6, 0.18],
    [7.8, 8.1, 2.4, 1.7, 1.3, -0.22], [-6.4, 8.2, 1.4, 1.1, 1.0, 0.4], [-3.8, 8.5, 1.6, 1.3, 1.1, -0.3],
    [-0.8, 8.6, 1.8, 1.4, 1.2, 0.25], [2.0, 8.5, 1.5, 1.2, 1.0, -0.35], [4.5, 8.3, 1.7, 1.35, 1.15, 0.15],
    [6.8, 7.9, 1.3, 1.0, 0.95, -0.4],
  ];
  wall.forEach(([x, z, w, h, d, yaw], i) => p(K.wallBlock, x, z, yaw, 1, w, h, d, i % 2));
  for (const [x, z, r] of [[-5.0, 9.0, 0.55], [-2.0, 9.3, 0.7], [1.2, 9.4, 0.6], [4.0, 9.0, 0.55], [6.6, 8.4, 0.45]] as const) p(K.moss, x, z - 0.9, 0, r);
  p(K.firePit, 0, 0.4);
  p(K.tent, -5.6, 4.2, 0.55, 1, 0, 0, 0, 0);
  p(K.bedroll, -5.6 + 0.15, 4.2 - 0.15, 0.65);
  p(K.tent, -5.8, -1.6, -0.25, 1, 0, 0, 0, 1);
  p(K.bedroll, -5.8 + 0.15, -1.6 - 0.15, -0.15, 1, 0, 0, 0, 1);
  p(K.leanTo, 4.6, -0.9, -0.35);
  p(K.trainer, -4.35, 3.55, 0.4);
  p(K.stall, -3.5, -1.35, 0.15);
  p(K.crate, -3.5 + 0.85, -1.35 + 0.2, 0.15, 1, 0.48, 0.38, 0.4);
  p(K.crate, -3.5 - 1.15, -1.35 + 0.35, 0.15, 1, 0.42, 0.32, 0.36);
  p(K.weaponRack, 4.6, 2.85, -0.55);
  p(K.firewood, 2.4, -2.6);
  p(K.barrel, -1.8, -3.2);
  p(K.stone, 1.6, 3.8, 0.3, 0.8);
  p(K.banner, 1.05, 5.45);
  p(K.stone, -1.2, -4.2, 0.3, 1.1);
  p(K.chest, PH_STORAGE_CHEST.x, PH_STORAGE_CHEST.z, -0.35);
  for (const [x, z, yaw] of [[5.2, 2.0, 0.3], [-0.8, 4.2, 0.7], [2.6, -3.6, 1.2], [-2.6, 2.4, 2.0]] as const) p(K.pebble, x, z, yaw, 0.5);
}

function peaks(out: Prop[]): void {
  for (const m of PH_MOUNTAINS) {
    if (m.z <= -8) continue;
    out.push({ kind: K.peak, v: 0, x: m.x, z: m.z, y: paleHollowStandHeight(m.x, m.z), yaw: 0, s: peakRockScale(m.h), w: 0, h: m.h, d: 0 });
  }
}

/** Minimum height of a bank wall's coping above the water just inside it. */
export const RIVER_WALL_FREEBOARD = 0.25;

/** Bank retaining walls + bowl ends + stone bridges (old PaleHollowRiverBanks).
 * Segments run point to point with no overlap pad: the renderer miters shared
 * endpoints (props.rs `link_walls`) so joints and corners meet cleanly. */
function riverBanks(out: Prop[]): void {
  const wall = (a: { x: number; z: number }, b: { x: number; z: number }, pad: number) => {
    const x = (a.x + b.x) * 0.5, z = (a.z + b.z) * 0.5;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 0.15 || !Number.isFinite(x) || !Number.isFinite(z)) return;
    const y = paleHollowTerrainMeshY(x, z) + 0.04;
    // Where the bank sits low, the river surface can stand above a standard
    // wall's coping, so open water showed over the far wall as blue teeth.
    // Raise the wall there so its coping keeps a freeboard above the water
    // just inside it (visual only; collision is unchanged).
    const nx = -(b.z - a.z) / len, nz = (b.x - a.x) / len;
    let water = -Infinity;
    for (const k of [-1, 1]) for (const d of [0.4, 0.8]) {
      const wy = paleHollowWaterSurfaceY(x + nx * d * k, z + nz * d * k);
      if (wy != null) water = Math.max(water, wy);
    }
    const h = Math.max(PH_RIVER_WALL.h, water + RIVER_WALL_FREEBOARD - PH_RIVER_WALL.copeH - y);
    out.push({ kind: K.riverWall, v: 0, x, z, y, yaw: Math.atan2(b.x - a.x, b.z - a.z), s: len + pad, w: PH_RIVER_WALL.thick, h, d: PH_RIVER_WALL.copeH });
  };
  const runs: [PaleHollowRiverKind, (z: number) => number, { z0: number; z1: number; bankDist: number }, number][] = [
    ["main", paleHollowRiverCenterX, PH_RIVER_MAIN, 1.15],
    ["tributary", paleHollowTributaryCenterX, PH_RIVER_TRIB, 1.25],
  ];
  for (const [river, centerX, r, step] of runs) {
    const zs: number[] = [];
    for (let z = r.z0; z <= r.z1; z += step) zs.push(z);
    if (zs[zs.length - 1]! < r.z1 - 0.01) zs.push(r.z1);
    for (const side of [-1, 1] as const) {
      const pts = zs.map((z) => paleHollowBankPoint(river, z, side));
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i]!, b = pts[i + 1]!;
        if (paleHollowInBridgeWallVisualGap((a.x + b.x) / 2, (a.z + b.z) / 2, river)) continue;
        wall(a, b, 0);
      }
    }
    // semicircular bowls closing each channel end
    for (const [zEnd, outward] of [[r.z0, -1], [r.z1, 1]] as const) {
      const eps = 0.85;
      const tx = centerX(zEnd + eps) - centerX(zEnd - eps), tz = eps * 2, tl = Math.hypot(tx, tz) || 1;
      const fx = tx / tl, fz = tz / tl, rx = -fz, rz = fx, ox = fx * outward, oz = fz * outward, cx = centerX(zEnd);
      const n = Math.max(12, Math.round((Math.PI * r.bankDist) / 0.8));
      const pts = Array.from({ length: n + 1 }, (_, i) => {
        const th = Math.PI * (1 - i / n), c = Math.cos(th), s = Math.sin(th);
        return { x: cx + r.bankDist * (c * rx + s * ox), z: zEnd + r.bankDist * (c * rz + s * oz) };
      });
      for (let i = 0; i < n; i++) wall(pts[i]!, pts[i + 1]!, 0);
    }
  }
  for (const site of PH_BRIDGE_SITES) {
    const g = paleHollowBridgeGeom(site);
    out.push({ kind: K.bridge, v: Math.round(g.ramp * 200), x: g.x, z: g.zWorld, y: g.leftY, yaw: Math.atan2(g.spanDir.x, g.spanDir.z), s: g.span, w: PH_BRIDGE_DECK_W, h: g.arch, d: g.rightY });
  }
}

export function paleHollowProps(): Prop[] {
  const out: Prop[] = [];
  riverBanks(out);
  hub(out);
  peaks(out);
  trees(out);
  clutter(out);
  return out;
}

export function encodeProps(props: Prop[]): Buffer {
  const rec = 2 + 4 * 8;
  const buf = Buffer.alloc(8 + props.length * rec);
  buf.write("BAP1", 0, "ascii");
  buf.writeUInt32LE(props.length, 4);
  props.forEach((p, i) => {
    let o = 8 + i * rec;
    buf.writeUInt8(p.kind, o++);
    buf.writeUInt8(p.v, o++);
    for (const f of [p.x, p.z, p.y, p.yaw, p.s, p.w, p.h, p.d]) {
      buf.writeFloatLE(f, o);
      o += 4;
    }
  });
  return buf;
}

/**
 * Bridge walk heights sampled from the shared config (the server's stand
 * height) next to each bridge prop as baked for the client. Checked in at
 * `src/content/bridge-profile.json`; `src/bake-props.test.ts` keeps it in sync
 * with config and the renderer's Rust test checks its mesh against it.
 */
export function bridgeProfileSamples() {
  return PH_BRIDGE_SITES.map((site) => {
    const g = paleHollowBridgeGeom(site);
    const prop = paleHollowProps().find((p) => p.kind === K.bridge && Math.abs(p.x - g.x) < 1e-6 && Math.abs(p.z - g.zWorld) < 1e-6)!;
    const samples = Array.from({ length: 21 }, (_, i) => {
      const t = i / 20;
      // stay a hair inside the footprint at the ends
      const a = (Math.min(0.999, Math.max(0.001, t)) - 0.5) * g.span;
      const x = g.x + g.spanDir.x * a, z = g.zWorld + g.spanDir.z * a;
      return { t: Math.min(0.999, Math.max(0.001, t)), y: paleHollowBridgeDeckY(x, z)!, stand: paleHollowStandHeight(x, z) };
    });
    return { id: site.id, prop: { v: prop.v, y: prop.y, s: prop.s, w: prop.w, h: prop.h, d: prop.d }, samples };
  });
}

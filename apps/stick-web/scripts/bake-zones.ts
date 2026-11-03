/**
 * Bake zone grids for ba-stick-render from the same @bellgrave/config functions the
 * server uses (biome, stand height, water, walkability, trails, bridges).
 *
 * Output: public/zones/<id>.baz (gitignored), format "BAZ1" (little-endian):
 *   magic[4] | f32 minX | f32 minZ | f32 cell | u32 w | u32 h |
 *   u8 biome[w*h] | u8 flags[w*h] | i16 heightCm[w*h]
 * flags: 1 water, 2 trail, 4 bridge, 8 blocked, 16 stone trail
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { encodeProps, forestBasinProps, paleHollowProps, type Prop } from "./bake-props";
import { coilPassProps } from "./zone-props/coil-pass";
import { coilRidgeProps } from "./zone-props/coil-ridge";
import { greenReachProps } from "./zone-props/green-reach";
import { isletFordsProps } from "./zone-props/islet-fords";
import { ringWardProps } from "./zone-props/ring-ward";
import { hollowRoadProps } from "./zone-props/hollow-road";
import { spurRoadProps } from "./zone-props/spur-road";
import { bootForgeMenuProps } from "./zone-props/boot-forge-menu";
import { withSeamCamps } from "./zone-props/seam-country-camps";
import { dirname, resolve } from "node:path";
import { ecoMosaic, naturalBiome, trailVerge } from "./natural-edges";
import { fileURLToPath } from "node:url";
import {
  BOOT_FORGE_MENU_BOUNDS,
  bootForgeMenuBiome,
  bootForgeMenuInOpenWater,
  bootForgeMenuOnBridge,
  bootForgeMenuStandHeight,
  bootForgeMenuTrails,
  bootForgeMenuWalkable,
  bootForgeMenuWaterSurfaceY,
  FB_TRAIL_WIDTH,
  FOREST_BASIN_BOUNDS,
  PALE_HOLLOW_BOUNDS,
  forestBasinBiome,
  forestBasinInOpenWater,
  forestBasinOnBridge,
  forestBasinStandHeight,
  forestBasinTrails,
  forestBasinWalkable,
  forestBasinWaterSurfaceY,
  encodeFbWaterLayout,
  fbFallSurfaceY,
  paleHollowBiome,
  paleHollowInOpenWater,
  paleHollowOnBridge,
  paleHollowStandHeight,
  paleHollowTrails,
  paleHollowWalkable,
  paleHollowWaterSurfaceY,
  PH_TRAIL_WIDTH,
  ZONE_FIELDS,
} from "@bellgrave/config";

export const BIOMES = [
  "hub_indoor", "terrace", "farm", "river", "riverbank", "bridge", "ashbeam", "scrub",
  "quarry", "vine_cliff", "ore_seam", "crypt", "ash_road", "grass", "mountain", "meadow",
] as const;

type Seg = { ax: number; az: number; bx: number; bz: number; stone: boolean };

function segDist(px: number, pz: number, s: Seg): number {
  const dx = s.bx - s.ax, dz = s.bz - s.az;
  const l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - s.ax) * dx + (pz - s.az) * dz) / l2));
  return Math.hypot(px - (s.ax + t * dx), pz - (s.az + t * dz));
}

type BakeFns = {
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  biome: (x: number, z: number) => string;
  stand: (x: number, z: number) => number;
  water: (x: number, z: number) => number | null;
  openWater: (x: number, z: number) => boolean;
  onBridge: (x: number, z: number) => boolean;
  walkable: (x: number, z: number) => boolean;
  trails: { surface: string; points: { x: number; z: number }[] }[];
  trailWidth: number;
  /** Fall-face surface Y: water flag + blocked, height follows the drop. */
  fallFace?: (x: number, z: number) => number | null;
};

export function bakeZoneGrid(spec: BakeFns, cell = 0.5): Buffer {
  const { minX, maxX, minZ, maxZ } = spec.bounds;
  const w = Math.ceil((maxX - minX) / cell) + 1;
  const h = Math.ceil((maxZ - minZ) / cell) + 1;
  const segs: Seg[] = [];
  for (const t of spec.trails) {
    for (let i = 1; i < t.points.length; i++) {
      const a = t.points[i - 1]!, b = t.points[i]!;
      segs.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z, stone: t.surface === "stone" });
    }
  }
  const half = spec.trailWidth / 2;
  const header = 4 + 4 * 3 + 4 * 2;
  const buf = Buffer.alloc(header + w * h * 4);
  buf.write("BAZ1", 0, "ascii");
  buf.writeFloatLE(minX, 4);
  buf.writeFloatLE(minZ, 8);
  buf.writeFloatLE(cell, 12);
  buf.writeUInt32LE(w, 16);
  buf.writeUInt32LE(h, 20);
  const bio = header, flg = header + w * h, hgt = header + w * h * 2;
  const ownB = new Int16Array(w * h), trailD = new Float32Array(w * h);
  let lo = Infinity, hi = -Infinity;
  const natBiome = naturalBiome(spec.biome, (x, z) => spec.water(x, z) != null && (spec.openWater(x, z) || spec.onBridge(x, z)));
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const x = minX + i * cell, z = minZ + j * cell;
      const k = j * w + i;
      const biome = natBiome(x, z);
      ownB[k] = BIOMES.indexOf(spec.biome(x, z) as (typeof BIOMES)[number]);
      let flags = 0;
      let y = spec.stand(x, z);
      const water = spec.water(x, z);
      const onBr = spec.onBridge(x, z);
      // Channel under a bridge deck still has a water surface; openWater skips decks for gameplay.
      const wet = water != null && (spec.openWater(x, z) || onBr);
      if (onBr) {
        if (wet) {
          flags |= 1;
          y = water;
        } else {
          flags |= 4;
        }
      } else if (wet) {
        flags |= 1;
        y = water;
      } else {
        const fy = spec.fallFace?.(x, z);
        if (fy != null) {
          flags |= 1 | 8;
          y = fy;
        }
      }
      if (!spec.walkable(x, z)) flags |= 8;
      if (!(flags & 5)) {
        let td = Infinity;
        for (const s of segs) {
          const d = segDist(x, z, s);
          if (d < td) td = d;
          if (!(flags & 2) && d <= trailVerge(x, z, half)) flags |= 2 | (s.stone ? 16 : 0);
        }
        trailD[k] = td;
      } else trailD[k] = Infinity;
      buf.writeUInt8(Math.max(0, BIOMES.indexOf(biome as (typeof BIOMES)[number])), bio + k);
      buf.writeUInt8(flags, flg + k);
      buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(y * 100))), hgt + k * 2);
      if (!(flags & 9)) { lo = Math.min(lo, y); hi = Math.max(hi, y); }
    }
  }
  // Ecology pass (visual only): mosaic the warped classes using slope / elevation / trail distance.
  const span = Math.max(1, hi - lo);
  const hAt = (i: number, j: number) => buf.readInt16LE(hgt + (Math.min(h - 1, Math.max(0, j)) * w + Math.min(w - 1, Math.max(0, i))) * 2) / 100;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = j * w + i;
      const f = buf.readUInt8(flg + k);
      if (f & 5) continue;
      const own = BIOMES[ownB[k]!] ?? "grass";
      const cur = BIOMES[buf.readUInt8(bio + k)]!;
      const y = hAt(i, j);
      const slope = Math.max(Math.abs(hAt(i + 2, j) - hAt(i - 2, j)), Math.abs(hAt(i, j + 2) - hAt(i, j - 2))) / (4 * cell);
      const x = minX + i * cell, z = minZ + j * cell;
      const e = ecoMosaic(own, cur, spec.biome, x, z, { slope, elev: (y - lo) / span, trailD: trailD[k]!, trailHalf: half, blocked: (f & 8) !== 0 });
      buf.writeUInt8(Math.max(0, BIOMES.indexOf(e as (typeof BIOMES)[number])), bio + k);
    }
  }
  smoothWaterNotches(buf, w, h, bio, flg, hgt);
  floodThinShores(buf, w, h, bio, flg, hgt, minX, minZ, cell);
  bankShoreHeights(buf, w, h, bio, flg, hgt);
  return buf;
}

const AROUND = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
  [-1, -1], [1, -1], [-1, 1], [1, 1],
] as const;

/** Fill one-cell land juts into water so iso shores are not diamond teeth. */
function smoothWaterNotches(buf: Buffer, w: number, h: number, bio: number, flg: number, hgt: number) {
  const river = BIOMES.indexOf("river");
  const open = (i: number, j: number) => {
    if (i < 0 || j < 0 || i >= w || j >= h) return false;
    const f = buf.readUInt8(flg + j * w + i);
    return (f & 1) !== 0 && (f & 4) === 0;
  };
  for (let pass = 0; pass < 4; pass++) {
    const next = Buffer.from(buf.subarray(flg, flg + w * h));
    for (let j = 1; j < h - 1; j++) {
      for (let i = 1; i < w - 1; i++) {
        const k = j * w + i;
        const f = buf.readUInt8(flg + k);
        if ((f & 1) !== 0 || (f & 4) !== 0) continue;
        let card = 0;
        let all = 0;
        let hi = 0;
        let got = false;
        let left = false;
        let right = false;
        let up = false;
        let down = false;
        for (const [di, dj] of AROUND) {
          if (!open(i + di, j + dj)) continue;
          all++;
          const y = buf.readInt16LE(hgt + ((j + dj) * w + (i + di)) * 2);
          if (di === 0 || dj === 0) {
            card++;
            hi = y;
            got = true;
            if (di < 0) left = true;
            if (di > 0) right = true;
            if (dj < 0) up = true;
            if (dj > 0) down = true;
          } else if (!got) {
            hi = y;
            got = true;
          }
        }
        const pinch = (left && right) || (up && down);
        if (!pinch && card < 3 && !(card >= 2 && all >= 4) && all < 5) continue;
        next.writeUInt8(f | 1, k);
        buf.writeUInt8(river, bio + k);
        buf.writeInt16LE(hi, hgt + k * 2);
      }
    }
    next.copy(buf, flg);
  }
}

/** Eat thin land bars between water (meander spikes) without chewing islands or shoals. */
function floodThinShores(
  buf: Buffer, w: number, h: number, bio: number, flg: number, hgt: number,
  minX: number, minZ: number, cell: number,
) {
  const river = BIOMES.indexOf("river");
  const open = (i: number, j: number) => {
    if (i < 0 || j < 0 || i >= w || j >= h) return false;
    const f = buf.readUInt8(flg + j * w + i);
    return (f & 1) !== 0 && (f & 4) === 0;
  };
  const walk = (i: number, j: number, di: number, dj: number, max: number) => {
    for (let s = 1; s <= max; s++) {
      if (open(i + di * s, j + dj * s)) return s;
    }
    return max + 1;
  };
  const max = 16;
  for (let pass = 0; pass < 4; pass++) {
    const next = Buffer.from(buf.subarray(flg, flg + w * h));
    for (let j = 1; j < h - 1; j++) {
      for (let i = 1; i < w - 1; i++) {
        const k = j * w + i;
        const f = buf.readUInt8(flg + k);
        if ((f & 1) !== 0 || (f & 4) !== 0) continue;
        const x = minX + i * cell;
        const z = minZ + j * cell;
        if (onProtectedBar(x, z)) continue;
        const pinch =
          walk(i, j, -1, 0, max) + walk(i, j, 1, 0, max) <= max ||
          walk(i, j, 0, -1, max) + walk(i, j, 0, 1, max) <= max ||
          walk(i, j, -1, -1, max) + walk(i, j, 1, 1, max) <= max ||
          walk(i, j, -1, 1, max) + walk(i, j, 1, -1, max) <= max;
        if (!pinch) continue;
        let hi = 0;
        for (const [di, dj] of AROUND) {
          if (open(i + di, j + dj)) {
            hi = buf.readInt16LE(hgt + ((j + dj) * w + (i + di)) * 2);
            break;
          }
        }
        next.writeUInt8(f | 1, k);
        buf.writeUInt8(river, bio + k);
        buf.writeInt16LE(hi, hgt + k * 2);
      }
    }
    next.copy(buf, flg);
  }
}

function onProtectedBar(x: number, z: number): boolean {
  if (Math.hypot(x - 85, z - 30) < 8 || Math.hypot(x - 70, z - 13) < 6) return true;
  for (const b of [
    { ax: 64, az: 3, bx: 69, bz: 10, w: 1.6 },
    { ax: 72, az: 15, bx: 81, bz: 26, w: 1.4 },
  ] as const) {
    if (segDist(x, z, { ax: b.ax, az: b.az, bx: b.bx, bz: b.bz, stone: false }) <= b.w + 0.6) {
      return true;
    }
  }
  return false;
}

/** Flatten shore spikes. Hinterland cliffs (high land that stays high inland) stay. */
function bankShoreHeights(buf: Buffer, w: number, h: number, _bio: number, flg: number, hgt: number) {
  const open = (i: number, j: number) => {
    if (i < 0 || j < 0 || i >= w || j >= h) return false;
    const f = buf.readUInt8(flg + j * w + i);
    return (f & 1) !== 0 && (f & 4) === 0;
  };
  const nearWater = (i: number, j: number) => AROUND.some(([di, dj]) => open(i + di, j + dj));
  for (let j = 1; j < h - 1; j++) {
    for (let i = 1; i < w - 1; i++) {
      const k = j * w + i;
      const f = buf.readUInt8(flg + k);
      if ((f & 1) !== 0 || (f & 4) !== 0) continue;
      let wy = 0;
      let n = 0;
      let hinterland = 0;
      for (const [di, dj] of AROUND) {
        if (open(i + di, j + dj)) {
          wy += buf.readInt16LE(hgt + ((j + dj) * w + (i + di)) * 2);
          n++;
          continue;
        }
        const ni = i + di;
        const nj = j + dj;
        if (ni < 1 || nj < 1 || ni >= w - 1 || nj >= h - 1) continue;
        if ((buf.readUInt8(flg + nj * w + ni) & 4) !== 0) continue;
        if (!nearWater(ni, nj) && buf.readInt16LE(hgt + (nj * w + ni) * 2) > buf.readInt16LE(hgt + k * 2) - 35) {
          hinterland++;
        }
      }
      if (n === 0) {
        for (const [di, dj] of AROUND) {
          if (!open(i + di * 2, j + dj * 2)) continue;
          wy += buf.readInt16LE(hgt + ((j + dj * 2) * w + (i + di * 2)) * 2);
          n++;
        }
      }
      if (n === 0) continue;
      wy /= n;
      const ly = buf.readInt16LE(hgt + k * 2);
      if (ly - wy > 180 && hinterland >= 2) continue;
      if (ly > wy + 40) buf.writeInt16LE(Math.round(wy + 40), hgt + k * 2);
      else if (ly < wy - 40) buf.writeInt16LE(Math.round(wy + 20), hgt + k * 2);
    }
  }
}

export function bakePaleHollow(cell = 0.5): Buffer {
  return bakeZoneGrid({
    bounds: PALE_HOLLOW_BOUNDS,
    biome: paleHollowBiome,
    stand: paleHollowStandHeight,
    water: paleHollowWaterSurfaceY,
    openWater: paleHollowInOpenWater,
    onBridge: paleHollowOnBridge,
    walkable: paleHollowWalkable,
    trails: paleHollowTrails(),
    trailWidth: PH_TRAIL_WIDTH,
  }, cell);
}

export function bakeBootForgeMenu(cell = 0.5): Buffer {
  return bakeZoneGrid({
    bounds: BOOT_FORGE_MENU_BOUNDS,
    biome: bootForgeMenuBiome,
    stand: bootForgeMenuStandHeight,
    water: bootForgeMenuWaterSurfaceY,
    openWater: bootForgeMenuInOpenWater,
    onBridge: bootForgeMenuOnBridge,
    walkable: bootForgeMenuWalkable,
    trails: bootForgeMenuTrails(),
    trailWidth: 3.3,
  }, cell);
}

export function bakeForestBasin(cell = 0.5): Buffer {
  return bakeZoneGrid({
    bounds: FOREST_BASIN_BOUNDS,
    biome: forestBasinBiome,
    stand: forestBasinStandHeight,
    water: forestBasinWaterSurfaceY,
    openWater: forestBasinInOpenWater,
    onBridge: forestBasinOnBridge,
    walkable: forestBasinWalkable,
    trails: forestBasinTrails(),
    trailWidth: FB_TRAIL_WIDTH,
    fallFace: fbFallSurfaceY,
  }, cell);
}

const FIELD_PROPS: Record<string, () => Prop[]> = {
  hollow_road: hollowRoadProps,
  spur_road: spurRoadProps,
  ring_ward: ringWardProps,
  islet_fords: isletFordsProps,
  green_reach: greenReachProps,
  coil_pass: coilPassProps,
  coil_ridge: coilRidgeProps,
};

function writeZone(id: string, grid: Buffer, props: Prop[]) {
  const out = resolve(dirname(fileURLToPath(import.meta.url)), `../public/zones/${id}.baz`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, grid);
  console.log(`baked ${out} (${(grid.length / 1024).toFixed(0)} KiB)`);
  const pbuf = encodeProps(props);
  writeFileSync(out.replace(/\.baz$/, ".bap"), pbuf);
  console.log(`baked ${props.length} props (${(pbuf.length / 1024).toFixed(0)} KiB)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const only = process.argv[2];
  const chainOnly = only === "chain";
  const t0 = Date.now();
  if (!chainOnly && (!only || only === "pale_hollow")) writeZone("pale_hollow", bakePaleHollow(), paleHollowProps());
  if (!chainOnly && (!only || only === "forest_basin")) {
    writeZone("forest_basin", bakeForestBasin(), forestBasinProps());
    const wfl = resolve(dirname(fileURLToPath(import.meta.url)), "../public/zones/forest_basin.wfl");
    writeFileSync(wfl, encodeFbWaterLayout());
    console.log(`baked ${wfl}`);
  }
  if (!chainOnly && (!only || only === "boot_forge")) writeZone("boot_forge", bakeBootForgeMenu(), bootForgeMenuProps());
  for (const [id, props] of Object.entries(FIELD_PROPS)) {
    const spec = ZONE_FIELDS[id];
    if (!spec || (only && !chainOnly && only !== id)) continue;
    writeZone(id, bakeZoneGrid({
      bounds: spec.bounds,
      biome: spec.biome,
      stand: spec.stand,
      water: spec.water,
      openWater: spec.openWater,
      onBridge: spec.onBridge,
      walkable: spec.walkable,
      trails: spec.trails(),
      trailWidth: spec.trailWidth,
    }), withSeamCamps(id, props()));
  }
  console.log(`done in ${Date.now() - t0} ms`);
}

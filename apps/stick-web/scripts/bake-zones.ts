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
import { dirname, resolve } from "node:path";
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
  shoreFillGrid,
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
  /** Config already floods juts and thin bars (shared with the server). */
  sharedShore?: boolean;
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
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const x = minX + i * cell, z = minZ + j * cell;
      const k = j * w + i;
      const biome = spec.biome(x, z);
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
        for (const s of segs) {
          if (segDist(x, z, s) <= half) {
            flags |= 2 | (s.stone ? 16 : 0);
            break;
          }
        }
      }
      buf.writeUInt8(Math.max(0, BIOMES.indexOf(biome as (typeof BIOMES)[number])), bio + k);
      buf.writeUInt8(flags, flg + k);
      buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(y * 100))), hgt + k * 2);
    }
  }
  if (!spec.sharedShore) shoreCleanup(buf, w, h, bio, flg, hgt);
  bankShoreHeights(buf, w, h, bio, flg, hgt);
  return buf;
}

const AROUND = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
  [-1, -1], [1, -1], [-1, 1], [1, 1],
] as const;

/**
 * Fill one-cell land juts and thin land bars (meander spikes) with water.
 * Zones whose config owns the cleanup (Forest Basin: `fbShoreFillAt`) skip
 * this, since their spec water already includes it and the server agrees.
 * Same rule as the config: the lowest adjacent water level, keep bridges and
 * real banks. Biome, flags and heights all update together after the pass.
 */
function shoreCleanup(buf: Buffer, w: number, h: number, bio: number, flg: number, hgt: number) {
  const river = BIOMES.indexOf("river");
  const NONE = -32768;
  const surf = new Int16Array(w * h).fill(NONE);
  const ground = new Int16Array(w * h);
  const keep = new Uint8Array(w * h);
  for (let k = 0; k < w * h; k++) {
    const f = buf.readUInt8(flg + k);
    const y = buf.readInt16LE(hgt + k * 2);
    if (f & 4) keep[k] = 1;
    else if (f & 1) surf[k] = y;
    else ground[k] = y;
  }
  const out = shoreFillGrid(w, h, surf, ground, keep);
  for (let k = 0; k < w * h; k++) {
    if (surf[k] !== NONE || out[k] === NONE) continue;
    buf.writeUInt8(buf.readUInt8(flg + k) | 1, flg + k);
    buf.writeUInt8(river, bio + k);
    buf.writeInt16LE(out[k]!, hgt + k * 2);
  }
}

/** Flatten shore spikes. Hinterland cliffs (high land that stays high inland) stay. */
function bankShoreHeights(buf: Buffer, w: number, h: number, _bio: number, flg: number, hgtOut: number) {
  // Read from a snapshot so the result does not depend on scan order.
  const snap = Buffer.from(buf.subarray(0, hgtOut + w * h * 2));
  const hgt = hgtOut;
  const src = snap;
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
          wy += src.readInt16LE(hgt + ((j + dj) * w + (i + di)) * 2);
          n++;
          continue;
        }
        const ni = i + di;
        const nj = j + dj;
        if (ni < 1 || nj < 1 || ni >= w - 1 || nj >= h - 1) continue;
        if ((buf.readUInt8(flg + nj * w + ni) & 4) !== 0) continue;
        if (!nearWater(ni, nj) && src.readInt16LE(hgt + (nj * w + ni) * 2) > src.readInt16LE(hgt + k * 2) - 35) {
          hinterland++;
        }
      }
      if (n === 0) {
        for (const [di, dj] of AROUND) {
          if (!open(i + di * 2, j + dj * 2)) continue;
          wy += src.readInt16LE(hgt + ((j + dj * 2) * w + (i + di * 2)) * 2);
          n++;
        }
      }
      if (n === 0) continue;
      wy /= n;
      const ly = src.readInt16LE(hgt + k * 2);
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
    sharedShore: true,
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
    }), props());
  }
  console.log(`done in ${Date.now() - t0} ms`);
}

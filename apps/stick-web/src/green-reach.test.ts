import assert from "node:assert/strict";
import test from "node:test";
import { K } from "../scripts/bake-props";
import { greenReachProps } from "../scripts/zone-props/green-reach";
import { bakeZoneGrid } from "../scripts/bake-zones";
import {
  GR_BED,
  GR_BOUNDS,
  GR_GATES,
  GR_MAP_LABELS,
  GR_PEAKS,
  GR_POOLS,
  GR_ROAD_NAMES,
  GR_SPAWN,
  GR_SURFACE,
  GR_TRAIL_WIDTH,
  greenReachBiome,
  greenReachGateSoftLevel,
  greenReachInOpenWater,
  greenReachOnBridge,
  greenReachStandHeight,
  greenReachTrails,
  greenReachWalkable,
  greenReachWaterSurfaceY,
} from "../../../packages/config/src/green-reach";

test("green reach spawn is dry and both pools hold water", () => {
  assert.equal(GR_SPAWN.x, -70);
  assert.equal(GR_SPAWN.z, 8);
  assert.equal(GR_SPAWN.facing, 0);
  assert.equal(GR_TRAIL_WIDTH, 3.3);
  assert.equal(greenReachWalkable(GR_SPAWN.x, GR_SPAWN.z), true);
  assert.equal(greenReachInOpenWater(GR_SPAWN.x, GR_SPAWN.z), false);
  assert.equal(greenReachOnBridge(GR_SPAWN.x, GR_SPAWN.z), false);

  for (const p of GR_POOLS) {
    assert.equal(greenReachInOpenWater(p.x, p.z), true, `${p.x},${p.z}`);
    assert.equal(greenReachWalkable(p.x, p.z), false);
    assert.equal(greenReachBiome(p.x, p.z), "river");
    assert.equal(greenReachWaterSurfaceY(p.x, p.z), GR_SURFACE);
    const bed = greenReachStandHeight(p.x, p.z);
    assert.ok(Math.abs(bed - GR_BED) < 0.05, `bed ${bed}`);
    for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2]] as const) {
      assert.equal(greenReachInOpenWater(p.x + dx, p.z + dz), true, `${p.x + dx},${p.z + dz}`);
    }
  }

  assert.equal(greenReachWalkable(-16, 40), true);
  assert.equal(greenReachInOpenWater(-16, 40), false);
  for (const m of GR_PEAKS) {
    assert.equal(greenReachWalkable(m.x, m.z), false, `${m.x},${m.z}`);
    const cap = greenReachStandHeight(m.x, m.z);
    assert.ok(Math.abs(cap - m.h) < 0.05, `cap ${cap} expected ${m.h}`);
  }
  assert.equal(greenReachWalkable(-95, -80), false);
  assert.equal(greenReachBiome(-95, -80), "mountain");

  assert.deepEqual(
    GR_GATES.map((g) => [g.id, g.minX, g.maxX, g.minZ, g.maxZ, g.softLevel, g.blocked, g.destZone]),
    [
      ["claw-lip", -90, -78, 2, 14, 8, false, "islet_fords"],
      ["north-lip", -16, -4, 78, 90, 8, false, "coil_pass"],
    ],
  );
  assert.equal(greenReachGateSoftLevel(-84, 8), 8);
  assert.equal(greenReachGateSoftLevel(-10, 84), 8);
  assert.equal(greenReachGateSoftLevel(-70, 8), null);
});

test("green reach relief stays inside the sheet", () => {
  let minY = Infinity;
  let maxY = -Infinity;
  let walk = 0;
  let n = 0;
  const { minX, maxX, minZ, maxZ } = GR_BOUNDS;
  for (let z = minZ; z <= maxZ; z += 4) {
    for (let x = minX; x <= maxX; x += 4) {
      const y = greenReachStandHeight(x, z);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      n++;
      if (greenReachWalkable(x, z)) walk++;
    }
  }
  assert.ok(minY >= -0.5 && minY < 0.2, `relief min ${minY}`);
  assert.ok(maxY <= 11 && maxY > 7, `relief max ${maxY}`);
  const frac = walk / n;
  console.log(`green_reach walkable fraction ${frac.toFixed(3)} (${walk}/${n})`);
  assert.ok(frac > 0.28 && frac < 0.55, `walkable fraction ${frac.toFixed(3)}`);
});

test("green reach gates are reachable from the claw spawn", () => {
  const step = 4;
  const { minX, minZ, maxX, maxZ } = GR_BOUNDS;
  const cols = Math.ceil((maxX - minX) / step) + 1;
  const rows = Math.ceil((maxZ - minZ) / step) + 1;
  const seen = new Uint8Array(cols * rows);
  const key = (x: number, z: number) =>
    Math.round((x - minX) / step) + Math.round((z - minZ) / step) * cols;
  const q: [number, number][] = [[GR_SPAWN.x, GR_SPAWN.z]];
  seen[key(GR_SPAWN.x, GR_SPAWN.z)] = 1;
  for (let i = 0; i < q.length; i++) {
    const [x, z] = q[i]!;
    for (const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]] as const) {
      const nx = x + dx;
      const nz = z + dz;
      if (nx < minX || nx > maxX || nz < minZ || nz > maxZ) continue;
      const k = key(nx, nz);
      if (seen[k] || !greenReachWalkable(nx, nz)) continue;
      seen[k] = 1;
      q.push([nx, nz]);
    }
  }
  const reached = (x: number, z: number) => seen[key(x, z)] === 1;
  for (const g of GR_GATES) {
    const cx = (g.minX + g.maxX) / 2;
    const cz = (g.minZ + g.maxZ) / 2;
    assert.equal(g.blocked, false, g.id);
    assert.equal(greenReachWalkable(cx, cz), true, g.id);
    assert.equal(reached(cx, cz), true, g.id);
  }
});

test("green reach trail stays dry and every road is named", () => {
  const wet: string[] = [];
  for (const t of greenReachTrails()) {
    assert.equal(t.surface, "dirt");
    assert.ok(GR_ROAD_NAMES[t.id], t.id);
    for (let i = 1; i < t.points.length; i++) {
      const a = t.points[i - 1]!;
      const b = t.points[i]!;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.hypot(dx, dz) || 1;
      const nx = -dz / len;
      const nz = dx / len;
      for (let s = 0; s <= 16; s++) {
        const u = s / 16;
        const x = a.x + dx * u;
        const z = a.z + dz * u;
        for (const side of [0, 1.5, -1.5] as const) {
          const px = x + nx * side;
          const pz = z + nz * side;
          if (!greenReachWalkable(px, pz) || greenReachInOpenWater(px, pz)) {
            wet.push(`${t.id} ${px.toFixed(1)},${pz.toFixed(1)}`);
          }
        }
      }
    }
  }
  assert.deepEqual(wet, []);
  const kinds = new Map(GR_MAP_LABELS.map((l) => [l.text, l.kind]));
  assert.equal(kinds.get("Long Claw"), "area");
  assert.equal(kinds.get("Still Pool"), "water");
  assert.equal(kinds.get("White Caps"), "landmark");
  assert.equal(kinds.get("South Point"), "area");
  for (const l of GR_MAP_LABELS) {
    assert.ok(l.x >= GR_BOUNDS.minX && l.x <= GR_BOUNDS.maxX);
    assert.ok(l.z >= GR_BOUNDS.minZ && l.z <= GR_BOUNDS.maxZ);
  }
});

test("green reach props stay under the budget and off the pools", () => {
  const props = greenReachProps();
  assert.ok(props.length < 2500, `props ${props.length}`);
  const peaks = props.filter((p) => p.kind === K.peak);
  assert.equal(peaks.length, 3);
  for (const p of peaks) {
    assert.equal(p.s, Math.max(0.7, p.h / 8));
    assert.equal(p.y, greenReachStandHeight(p.x, p.z));
    assert.ok(p.h >= 7.2 && p.h <= 8.5);
  }
  let trees = 0;
  for (const p of props) {
    if (p.kind === K.peak) continue;
    assert.ok(p.kind === K.pine || p.kind === K.spruce, `kind ${p.kind}`);
    assert.equal(greenReachWalkable(p.x, p.z), true);
    assert.equal(greenReachInOpenWater(p.x, p.z), false);
    const b = greenReachBiome(p.x, p.z);
    assert.ok(b === "grass" || b === "meadow", b);
    for (const m of GR_PEAKS) {
      assert.ok(Math.hypot(p.x - m.x, p.z - m.z) >= m.r * 0.38);
    }
    trees++;
  }
  assert.ok(trees > 20, `trees ${trees}`);
  console.log(`green_reach props ${props.length} (trees ${trees}, peaks ${peaks.length})`);
});

test("green reach bake is the area-sheet byte length", () => {
  const buf = bakeZoneGrid({
    bounds: GR_BOUNDS,
    biome: greenReachBiome,
    stand: greenReachStandHeight,
    water: greenReachWaterSurfaceY,
    openWater: greenReachInOpenWater,
    onBridge: greenReachOnBridge,
    walkable: greenReachWalkable,
    trails: greenReachTrails(),
    trailWidth: GR_TRAIL_WIDTH,
  });
  const cell = 0.5;
  const w = Math.ceil((GR_BOUNDS.maxX - GR_BOUNDS.minX) / cell) + 1;
  const h = Math.ceil((GR_BOUNDS.maxZ - GR_BOUNDS.minZ) / cell) + 1;
  assert.equal(w, 441);
  assert.equal(h, 401);
  assert.equal(buf.length, 24 + 4 * w * h);
  assert.equal(buf.toString("ascii", 0, 4), "BAZ1");
});

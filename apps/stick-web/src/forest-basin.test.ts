import assert from "node:assert/strict";
import test from "node:test";
import {
  FB_GATES,
  FB_LAKE,
  FB_MAP_LABELS,
  FB_ROAD_NAMES,
  FB_SPAWN,
  FOREST_BASIN_BOUNDS,
  forestBasinInOpenWater,
  forestBasinStandHeight,
  forestBasinTrails,
  forestBasinWalkable,
} from "@bellgrave/config";
import { bakeForestBasin } from "../scripts/bake-zones";

test("forest basin spawn is dry ground and the mere holds water", () => {
  assert.equal(forestBasinWalkable(FB_SPAWN.x, FB_SPAWN.z), true);
  assert.equal(forestBasinInOpenWater(FB_SPAWN.x, FB_SPAWN.z), false);
  assert.equal(forestBasinInOpenWater(FB_LAKE.x, FB_LAKE.z), true);
  assert.equal(forestBasinInOpenWater(FB_LAKE.x + FB_LAKE.r + 8, FB_LAKE.z), false);
});

test("forest basin relief stays inside 12 m and the mask is a branching fraction of the box", () => {
  let minY = Infinity;
  let maxY = -Infinity;
  let walk = 0;
  let n = 0;
  const { minX, maxX, minZ, maxZ } = FOREST_BASIN_BOUNDS;
  for (let z = minZ; z <= maxZ; z += 4) {
    for (let x = minX; x <= maxX; x += 4) {
      const y = forestBasinStandHeight(x, z);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      n++;
      if (forestBasinWalkable(x, z)) walk++;
    }
  }
  assert.ok(minY >= -0.5 && maxY <= 11.5, `relief ${minY}..${maxY}`);
  const frac = walk / n;
  assert.ok(frac > 0.28 && frac < 0.55, `walkable fraction ${frac.toFixed(3)}`);
});

test("forest basin gates are reachable from the spur camp", () => {
  const step = 2;
  const { minX, minZ, maxX, maxZ } = FOREST_BASIN_BOUNDS;
  const cols = Math.ceil((maxX - minX) / step) + 1;
  const rows = Math.ceil((maxZ - minZ) / step) + 1;
  const seen = new Uint8Array(cols * rows);
  const key = (x: number, z: number) =>
    Math.round((x - minX) / step) + Math.round((z - minZ) / step) * cols;
  const q: [number, number][] = [[FB_SPAWN.x, FB_SPAWN.z]];
  seen[key(FB_SPAWN.x, FB_SPAWN.z)] = 1;
  for (let i = 0; i < q.length; i++) {
    const [x, z] = q[i]!;
    for (const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]] as const) {
      const nx = x + dx;
      const nz = z + dz;
      if (nx < minX || nx > maxX || nz < minZ || nz > maxZ) continue;
      const k = key(nx, nz);
      if (seen[k] || !forestBasinWalkable(nx, nz)) continue;
      seen[k] = 1;
      q.push([nx, nz]);
    }
  }
  const reached = (x: number, z: number) => seen[key(x, z)] === 1;
  for (const g of FB_GATES) {
    const cx = (g.minX + g.maxX) / 2;
    const cz = (g.minZ + g.maxZ) / 2;
    if (!g.blocked) {
      assert.equal(forestBasinWalkable(cx, cz), true, g.id);
      assert.equal(reached(cx, cz), true, g.id);
    } else {
      assert.equal(forestBasinWalkable(cx, cz), false, g.id);
      let approach = false;
      for (let z = g.minZ - 10; z <= g.maxZ + 10 && !approach; z += 2) {
        for (let x = g.minX - 10; x <= g.maxX + 10; x += 2) {
          if (x >= g.minX && x <= g.maxX && z >= g.minZ && z <= g.maxZ) continue;
          if (reached(x, z)) approach = true;
        }
      }
      assert.equal(approach, true, g.id);
    }
  }
});

test("forest basin roads stay out of the water and every road is named", () => {
  const wet: string[] = [];
  for (const t of forestBasinTrails()) {
    assert.ok(FB_ROAD_NAMES[t.id], t.id);
    for (let i = 1; i < t.points.length; i++) {
      const a = t.points[i - 1]!;
      const b = t.points[i]!;
      for (let s = 0; s <= 16; s++) {
        const u = s / 16;
        const x = a.x + (b.x - a.x) * u;
        const z = a.z + (b.z - a.z) * u;
        if (forestBasinInOpenWater(x, z) && !forestBasinWalkable(x, z)) wet.push(`${t.id} ${x.toFixed(1)},${z.toFixed(1)}`);
      }
    }
  }
  assert.deepEqual(wet, []);
  for (const l of FB_MAP_LABELS) {
    assert.ok(l.x >= FOREST_BASIN_BOUNDS.minX && l.x <= FOREST_BASIN_BOUNDS.maxX);
    assert.ok(l.z >= FOREST_BASIN_BOUNDS.minZ && l.z <= FOREST_BASIN_BOUNDS.maxZ);
  }
});

test("forest basin bake is the area-sheet byte length", () => {
  const buf = bakeForestBasin();
  const w = 641;
  const h = 641;
  assert.equal(buf.length, 24 + 4 * w * h);
  assert.equal(buf.toString("ascii", 0, 4), "BAZ1");
});

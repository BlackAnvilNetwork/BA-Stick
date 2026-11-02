import assert from "node:assert/strict";
import test from "node:test";
import {
  FB_GATES,
  FB_MAP_LABELS,
  FB_SPAWN,
  FOREST_BASIN_BOUNDS,
  forestBasinInOpenWater,
  forestBasinStandHeight,
  forestBasinTrails,
  forestBasinWalkable,
} from "@bellgrave/config";
import { bakeForestBasin } from "../scripts/bake-zones";

test("forest basin blank canvas: flat spawn and no water", () => {
  assert.equal(forestBasinWalkable(FB_SPAWN.x, FB_SPAWN.z), true);
  assert.equal(forestBasinInOpenWater(FB_SPAWN.x, FB_SPAWN.z), false);
  assert.equal(forestBasinStandHeight(0, 0), 2);
});

test("forest basin blank canvas: nearly full pad walkable", () => {
  let walk = 0;
  let n = 0;
  const { minX, maxX, minZ, maxZ } = FOREST_BASIN_BOUNDS;
  for (let z = minZ; z <= maxZ; z += 4) {
    for (let x = minX; x <= maxX; x += 4) {
      n++;
      if (forestBasinWalkable(x, z)) walk++;
    }
  }
  const frac = walk / n;
  assert.ok(frac > 0.85, `walkable fraction ${frac.toFixed(3)}`);
});

test("forest basin gates stay reachable from spawn", () => {
  const step = 2;
  const { minX, minZ, maxX, maxZ } = FOREST_BASIN_BOUNDS;
  const cols = Math.ceil((maxX - minX) / step) + 1;
  const key = (x: number, z: number) =>
    Math.round((x - minX) / step) + Math.round((z - minZ) / step) * cols;
  const q: [number, number][] = [[FB_SPAWN.x, FB_SPAWN.z]];
  const seen = new Uint8Array(cols * Math.ceil((maxZ - minZ) / step) + 1);
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
    }
  }
});

test("forest basin has no trails until authored", () => {
  assert.deepEqual(forestBasinTrails(), []);
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

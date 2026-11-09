import assert from "node:assert/strict";
import test from "node:test";
import {
  SR_BOUNDS,
  SR_GATES,
  SR_MAP_LABELS,
  SR_ROAD_NAMES,
  SR_SPAWN,
  SR_TRAIL_WIDTH,
  spurRoadBiome,
  spurRoadGateSoftLevel,
  spurRoadInOpenWater,
  spurRoadOnBridge,
  spurRoadStandHeight,
  spurRoadTrails,
  spurRoadWalkable,
  spurRoadWaterSurfaceY,
} from "../../../packages/config/src/spur-road.ts";
import { spurRoadProps } from "../scripts/zone-props/spur-road.ts";
import { bakeZoneGrid } from "../scripts/bake-zones";

test("spur road spawn is dry ground", () => {
  assert.equal(spurRoadWalkable(SR_SPAWN.x, SR_SPAWN.z), true);
  assert.equal(spurRoadInOpenWater(SR_SPAWN.x, SR_SPAWN.z), false);
  assert.equal(spurRoadWaterSurfaceY(SR_SPAWN.x, SR_SPAWN.z), null);
  assert.equal(spurRoadOnBridge(SR_SPAWN.x, SR_SPAWN.z), false);
  assert.equal(SR_SPAWN.facing, 0);
  assert.equal(SR_TRAIL_WIDTH, 3.3);
});

test("spur road grade is one hump with a camp shelf and banks", () => {
  const y = (x: number, z: number) => spurRoadStandHeight(x, z);
  assert.ok(Math.abs(y(0, 0) - 1.4) < 1e-9, `south ${y(0, 0)}`);
  assert.ok(Math.abs(y(0, 100) - 3.2) < 1e-9, `crest ${y(0, 100)}`);
  assert.ok(Math.abs(y(0, 200) - 1.6) < 1e-9, `north ${y(0, 200)}`);

  // South lip stays flat on the grade. It meets the Forest Basin gate.
  for (const x of [-6, -3, 0, 3, 6]) {
    for (const z of [0, 5, 10]) {
      assert.ok(Math.abs(y(x, z) - y(0, z)) < 1e-9, `south lip ${x},${z}`);
    }
  }
  assert.ok(y(0, 10) < 1.5, `south lip climbed to ${y(0, 10)}`);

  let prev = y(0, 0);
  for (let z = 10; z <= 100; z += 10) {
    const h = y(0, z);
    assert.ok(h >= prev - 1e-9, `climb ${z}: ${h} < ${prev}`);
    prev = h;
  }
  prev = y(0, 100);
  for (let z = 110; z <= 200; z += 10) {
    const h = y(0, z);
    assert.ok(h <= prev + 1e-9, `fall ${z}: ${h} > ${prev}`);
    prev = h;
  }
  assert.ok(y(0, 50) > 1.4 && y(0, 50) < 3.2);
  assert.ok(y(0, 150) > 1.6 && y(0, 150) < 3.2);

  // Camp props sit on one level shelf at the crest.
  for (const [x, z] of [
    [0, 100],
    [-6, 97],
    [6.5, 103],
    [-5, 106],
    [2.5, 101],
    [5, 95],
    [-4, 94],
  ] as const) {
    assert.ok(Math.abs(y(x, z) - 3.2) < 1e-6, `shelf ${x},${z} = ${y(x, z)}`);
  }

  // A 4 m bank beside the road clears the iso threshold (~0.5 m) and stays under 4 m.
  assert.ok(y(12, 100) - y(0, 100) >= 0.5, `crest bank ${y(12, 100)}`);
  assert.ok(y(12, 40) - y(0, 40) >= 0.5, `mid bank ${y(12, 40) - y(0, 40)}`);
  assert.ok(y(12, 0) - y(0, 0) >= 0.5, `south bank ${y(12, 0) - y(0, 0)}`);
  assert.ok(y(8, 40) === y(0, 40), "road crown stays flat");
  assert.ok(y(16, 100) < 4 && y(-16, 40) < 4 && y(18, 0) < 4);
});

test("spur road relief stays under 4 m", () => {
  let minY = Infinity;
  let maxY = -Infinity;
  let walk = 0;
  let n = 0;
  const { minX, maxX, minZ, maxZ } = SR_BOUNDS;
  for (let z = minZ; z <= maxZ; z += 4) {
    for (let x = minX; x <= maxX; x += 4) {
      const y = spurRoadStandHeight(x, z);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      n++;
      if (spurRoadWalkable(x, z)) walk++;
    }
  }
  assert.ok(minY >= -0.5 && maxY < 4, `relief ${minY}..${maxY}`);
  const frac = walk / n;
  console.log(`spur_road walkable fraction ${frac.toFixed(3)}`);
  assert.ok(frac > 0.35 && frac < 0.6, `walkable fraction ${frac.toFixed(3)}`);
});

test("spur road gates are reachable from the mid rise", () => {
  const step = 2;
  const { minX, minZ, maxX, maxZ } = SR_BOUNDS;
  const cols = Math.ceil((maxX - minX) / step) + 1;
  const rows = Math.ceil((maxZ - minZ) / step) + 1;
  const seen = new Uint8Array(cols * rows);
  const key = (x: number, z: number) =>
    Math.round((x - minX) / step) + Math.round((z - minZ) / step) * cols;
  const q: [number, number][] = [[SR_SPAWN.x, SR_SPAWN.z]];
  seen[key(SR_SPAWN.x, SR_SPAWN.z)] = 1;
  for (let i = 0; i < q.length; i++) {
    const [x, z] = q[i]!;
    for (const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]] as const) {
      const nx = x + dx;
      const nz = z + dz;
      if (nx < minX || nx > maxX || nz < minZ || nz > maxZ) continue;
      const k = key(nx, nz);
      if (seen[k] || !spurRoadWalkable(nx, nz)) continue;
      seen[k] = 1;
      q.push([nx, nz]);
    }
  }
  const reached = (x: number, z: number) => seen[key(x, z)] === 1;
  assert.deepEqual(
    SR_GATES.map((g) => [g.id, g.minX, g.maxX, g.minZ, g.maxZ, g.softLevel, g.blocked, g.destZone]),
    [
      ["south-lip", -6, 6, 0, 10, 8, false, "forest_basin"],
      ["north-lip", -6, 6, 190, 200, 8, false, "ring_ward"],
    ],
  );
  for (const g of SR_GATES) {
    const cx = (g.minX + g.maxX) / 2;
    const cz = (g.minZ + g.maxZ) / 2;
    assert.equal(spurRoadWalkable(cx, cz), true, g.id);
    assert.equal(spurRoadInOpenWater(cx, cz), false, g.id);
    assert.equal(reached(cx, cz), true, g.id);
    assert.equal(spurRoadGateSoftLevel(cx, cz), g.softLevel, g.id);
  }
});

test("spur road has one named dirt trail and the mid rise label", () => {
  const trails = spurRoadTrails();
  assert.equal(trails.length, 1);
  assert.equal(trails[0]!.surface, "dirt");
  assert.equal(SR_ROAD_NAMES[trails[0]!.id], "Center Road");
  for (const l of SR_MAP_LABELS) {
    assert.equal(l.text, "Mid Rise");
    assert.equal(l.kind, "camp");
    assert.ok(l.x >= SR_BOUNDS.minX && l.x <= SR_BOUNDS.maxX);
    assert.ok(l.z >= SR_BOUNDS.minZ && l.z <= SR_BOUNDS.maxZ);
  }
});

test("spur road props stay on the pad or the shoulders and under the cap", () => {
  const props = spurRoadProps();
  assert.ok(props.length > 0 && props.length < 400, `props ${props.length}`);
  const camp = props.filter((p) => p.kind === 32 || p.kind === 33 || p.kind === 35);
  assert.ok(camp.length >= 4);
  for (const p of camp) {
    assert.ok(Math.hypot(p.x, p.z - 100) <= 14, `${p.kind} at ${p.x},${p.z}`);
    assert.equal(spurRoadWalkable(p.x, p.z), true);
  }
  for (const p of props) {
    if (p.kind !== 14 && p.kind !== 18) continue;
    assert.equal(spurRoadWalkable(p.x, p.z), true);
    assert.ok(Math.abs(p.x) > 2);
    assert.ok(Math.hypot(p.x, p.z - 100) >= 12);
  }
});

test("spur road bake is the area-sheet byte length", () => {
  const { minX, maxX, minZ, maxZ } = SR_BOUNDS;
  const w = Math.ceil((maxX - minX) / 0.5) + 1;
  const h = Math.ceil((maxZ - minZ) / 0.5) + 1;
  const buf = bakeZoneGrid({
    bounds: SR_BOUNDS,
    biome: spurRoadBiome,
    stand: spurRoadStandHeight,
    water: spurRoadWaterSurfaceY,
    openWater: spurRoadInOpenWater,
    onBridge: spurRoadOnBridge,
    walkable: spurRoadWalkable,
    trails: spurRoadTrails(),
    trailWidth: SR_TRAIL_WIDTH,
  });
  assert.equal(w, 73);
  assert.equal(h, 401);
  assert.equal(buf.length, 24 + 4 * w * h);
  assert.equal(buf.toString("ascii", 0, 4), "BAZ1");
});

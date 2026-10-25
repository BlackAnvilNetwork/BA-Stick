import assert from "node:assert/strict";
import test from "node:test";
import {
  RW_BOUNDS,
  RW_BRIDGE,
  RW_CANAL,
  RW_GATES,
  RW_MAP_LABELS,
  RW_ROAD_NAMES,
  RW_SPAWN,
  RW_TRAIL_WIDTH,
  RW_WHARF,
  ringWardBiome,
  ringWardGateSoftLevel,
  ringWardInOpenWater,
  ringWardOnBridge,
  ringWardStandHeight,
  ringWardTrails,
  ringWardWalkable,
  ringWardWaterSurfaceY,
} from "../../../packages/config/src/ring-ward.ts";
import { ringWardProps } from "../scripts/zone-props/ring-ward.ts";
import { bakeZoneGrid } from "../scripts/bake-zones";

test("ring ward spawn is dry ground", () => {
  assert.equal(ringWardWalkable(RW_SPAWN.x, RW_SPAWN.z), true);
  assert.equal(ringWardInOpenWater(RW_SPAWN.x, RW_SPAWN.z), false);
  assert.equal(RW_SPAWN.facing, 0);
  assert.equal(RW_TRAIL_WIDTH, 3.3);
  assert.equal(ringWardInOpenWater(RW_CANAL.x, 0), true);
  assert.equal(ringWardWalkable(RW_CANAL.x, 0), false);
  assert.equal(ringWardWaterSurfaceY(RW_CANAL.x, 0), RW_CANAL.surface);
  assert.equal(ringWardInOpenWater(RW_WHARF.x, RW_WHARF.z), true);
  assert.equal(ringWardInOpenWater(-78, -64), true);
});

test("ring ward relief stays inside 6 m", () => {
  let minY = Infinity;
  let maxY = -Infinity;
  let walk = 0;
  let n = 0;
  const { minX, maxX, minZ, maxZ } = RW_BOUNDS;
  for (let z = minZ; z <= maxZ; z += 4) {
    for (let x = minX; x <= maxX; x += 4) {
      const y = ringWardStandHeight(x, z);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      n++;
      if (ringWardWalkable(x, z)) walk++;
    }
  }
  assert.ok(minY >= -0.5 && maxY <= 6, `relief ${minY}..${maxY}`);
  const frac = walk / n;
  console.log(`ring_ward walkable fraction ${frac.toFixed(3)}`);
  assert.ok(frac > 0.2 && frac < 0.6, `walkable fraction ${frac.toFixed(3)}`);
});

test("ring ward bridge is dry and both gate centers are reachable", () => {
  assert.equal(ringWardOnBridge(RW_BRIDGE.x, RW_BRIDGE.z), true);
  assert.equal(ringWardWalkable(RW_BRIDGE.x, RW_BRIDGE.z), true);
  assert.equal(ringWardInOpenWater(RW_BRIDGE.x, RW_BRIDGE.z), false);
  const deck = ringWardStandHeight(RW_BRIDGE.x, RW_BRIDGE.z);
  assert.ok(deck >= RW_CANAL.surface + 0.45 - 1e-9, `deck ${deck}`);
  assert.equal(ringWardBiome(RW_BRIDGE.x, RW_BRIDGE.z), "bridge");

  const step = 4;
  const { minX, minZ, maxX, maxZ } = RW_BOUNDS;
  const cols = Math.ceil((maxX - minX) / step) + 1;
  const rows = Math.ceil((maxZ - minZ) / step) + 1;
  const seen = new Uint8Array(cols * rows);
  const key = (x: number, z: number) =>
    Math.round((x - minX) / step) + Math.round((z - minZ) / step) * cols;
  const q: [number, number][] = [[RW_SPAWN.x, RW_SPAWN.z]];
  seen[key(RW_SPAWN.x, RW_SPAWN.z)] = 1;
  for (let i = 0; i < q.length; i++) {
    const [x, z] = q[i]!;
    for (const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]] as const) {
      const nx = x + dx;
      const nz = z + dz;
      if (nx < minX || nx > maxX || nz < minZ || nz > maxZ) continue;
      const k = key(nx, nz);
      if (seen[k] || !ringWardWalkable(nx, nz)) continue;
      seen[k] = 1;
      q.push([nx, nz]);
    }
  }
  const reached = (x: number, z: number) => seen[key(x, z)] === 1;
  assert.deepEqual(
    RW_GATES.map((g) => [g.id, g.minX, g.maxX, g.minZ, g.maxZ, g.softLevel, g.blocked, g.destZone]),
    [
      ["north-gap", -8, 8, 78, 90, 6, false, "spur_road"],
      ["wharf-gap", 52, 64, -78, -66, 6, false, "islet_fords"],
    ],
  );
  for (const g of RW_GATES) {
    const cx = (g.minX + g.maxX) / 2;
    const cz = (g.minZ + g.maxZ) / 2;
    assert.equal(ringWardWalkable(cx, cz), true, g.id);
    assert.equal(ringWardInOpenWater(cx, cz), false, g.id);
    assert.equal(reached(cx, cz), true, g.id);
    assert.equal(ringWardGateSoftLevel(cx, cz), 6, g.id);
    for (const x of [g.minX, g.maxX]) {
      for (const z of [g.minZ, g.maxZ]) {
        assert.equal(ringWardInOpenWater(x, z), false, `${g.id} corner ${x},${z}`);
        assert.equal(ringWardWalkable(x, z), true, `${g.id} corner ${x},${z}`);
      }
    }
  }
});

test("ring ward trails stay dry and the labels match the sheet", () => {
  const wet: string[] = [];
  for (const t of ringWardTrails()) {
    assert.ok(RW_ROAD_NAMES[t.id], t.id);
    assert.ok(t.points.length >= 2, t.id);
    for (let i = 1; i < t.points.length; i++) {
      const a = t.points[i - 1]!;
      const b = t.points[i]!;
      for (let s = 0; s <= 16; s++) {
        const u = s / 16;
        const x = a.x + (b.x - a.x) * u;
        const z = a.z + (b.z - a.z) * u;
        if (ringWardInOpenWater(x, z) && !ringWardWalkable(x, z)) wet.push(`${t.id} ${x.toFixed(1)},${z.toFixed(1)}`);
      }
    }
  }
  assert.deepEqual(wet, []);
  assert.deepEqual(
    RW_MAP_LABELS.map((l) => [l.text, l.x, l.z, l.kind]),
    [
      ["Inner Keep", 0, 0, "landmark"],
      ["Outer Ring", 0, 74, "area"],
      ["West Canal", -62, 20, "water"],
      ["South Wharf", 70, -70, "water"],
    ],
  );
});

test("ring ward props keep the wall, the canal, and the bridge under the cap", () => {
  const props = ringWardProps();
  assert.ok(props.length > 0 && props.length <= 2500, `props ${props.length}`);
  assert.ok(props.some((p) => p.kind === 30), "outer wall");
  assert.ok(props.some((p) => p.kind === 47), "canal wall");
  const bridges = props.filter((p) => p.kind === 48);
  assert.equal(bridges.length, 1);
  assert.ok(Math.abs(bridges[0]!.x - RW_BRIDGE.x) < 1e-6);
  assert.ok(Math.abs(bridges[0]!.z - RW_BRIDGE.z) < 1e-6);
  assert.ok(props.some((p) => p.kind === 39 && Math.hypot(p.x, p.z) < 14), "keep stall");
  assert.ok(props.some((p) => (p.kind === 35 || p.kind === 42 || p.kind === 39) && p.x > 16), "street clutter");
  for (const p of props) {
    if (p.kind > 4) continue;
    assert.ok(Math.hypot(p.x, p.z) >= 40, `tree ${p.x},${p.z}`);
  }
});

test("ring ward bake is the area-sheet byte length", () => {
  const { minX, maxX, minZ, maxZ } = RW_BOUNDS;
  const w = Math.ceil((maxX - minX) / 0.5) + 1;
  const h = Math.ceil((maxZ - minZ) / 0.5) + 1;
  const buf = bakeZoneGrid({
    bounds: RW_BOUNDS,
    biome: ringWardBiome,
    stand: ringWardStandHeight,
    water: ringWardWaterSurfaceY,
    openWater: ringWardInOpenWater,
    onBridge: ringWardOnBridge,
    walkable: ringWardWalkable,
    trails: ringWardTrails(),
    trailWidth: RW_TRAIL_WIDTH,
  });
  assert.equal(w, 401);
  assert.equal(h, 401);
  assert.equal(buf.length, 24 + 4 * w * h);
  assert.equal(buf.toString("ascii", 0, 4), "BAZ1");
});

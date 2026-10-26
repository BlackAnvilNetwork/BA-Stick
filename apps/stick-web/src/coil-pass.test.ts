import assert from "node:assert/strict";
import test from "node:test";
import {
  CP_BOUNDS,
  CP_GATES,
  CP_MAP_LABELS,
  CP_ROAD_NAMES,
  CP_SPAWN,
  CP_TRAIL_WIDTH,
  coilPassBiome,
  coilPassGateSoftLevel,
  coilPassHeight,
  coilPassInOpenWater,
  coilPassOnBridge,
  coilPassStandHeight,
  coilPassTrails,
  coilPassWalkable,
  coilPassWaterSurfaceY,
} from "../../../packages/config/src/coil-pass";
import { bakeZoneGrid } from "../scripts/bake-zones";
import { coilPassProps } from "../scripts/zone-props/coil-pass";

test("coil pass spawn is dry ground on the road", () => {
  assert.equal(coilPassWalkable(CP_SPAWN.x, CP_SPAWN.z), true);
  assert.equal(coilPassInOpenWater(CP_SPAWN.x, CP_SPAWN.z), false);
  assert.equal(coilPassWaterSurfaceY(CP_SPAWN.x, CP_SPAWN.z), null);
  assert.equal(coilPassOnBridge(CP_SPAWN.x, CP_SPAWN.z), false);
  assert.equal(CP_SPAWN.facing, 0);
  assert.equal(CP_TRAIL_WIDTH, 3.3);
  const road = 2 + 6 * (CP_SPAWN.z / 180);
  assert.ok(Math.abs(coilPassStandHeight(CP_SPAWN.x, CP_SPAWN.z) - road) < 1e-9);
  assert.equal(coilPassHeight(CP_SPAWN.x, CP_SPAWN.z), coilPassStandHeight(CP_SPAWN.x, CP_SPAWN.z));
});

test("coil pass relief stays under 10 m", () => {
  let minY = Infinity;
  let maxY = -Infinity;
  let walk = 0;
  let n = 0;
  let wet = 0;
  const { minX, maxX, minZ, maxZ } = CP_BOUNDS;
  for (let z = minZ; z <= maxZ; z += 4) {
    for (let x = minX; x <= maxX; x += 4) {
      const y = coilPassStandHeight(x, z);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      n++;
      if (coilPassWalkable(x, z)) walk++;
      if (coilPassInOpenWater(x, z)) wet++;
    }
  }
  assert.ok(minY >= -0.5 && maxY < 10, `relief ${minY}..${maxY}`);
  assert.equal(wet, 0);
  const frac = walk / n;
  console.log(`coil_pass walkable fraction ${frac.toFixed(3)} (${walk}/${n})`);
  assert.ok(frac > 0.2 && frac < 0.4, `walkable fraction ${frac.toFixed(3)}`);
});

test("coil pass gates match the lip contract and are reachable from spawn", () => {
  assert.deepEqual(
    CP_GATES.map((g) => ({
      id: g.id,
      minX: g.minX,
      maxX: g.maxX,
      minZ: g.minZ,
      maxZ: g.maxZ,
      softLevel: g.softLevel,
      blocked: g.blocked,
      destZone: g.destZone,
    })),
    [
      { id: "south-lip", minX: -8, maxX: 8, minZ: 0, maxZ: 12, softLevel: 8, blocked: false, destZone: "green_reach" },
      { id: "north-lip", minX: -8, maxX: 8, minZ: 168, maxZ: 180, softLevel: 8, blocked: false, destZone: "coil_ridge" },
    ],
  );

  const step = 2;
  const { minX, minZ, maxX, maxZ } = CP_BOUNDS;
  const cols = Math.ceil((maxX - minX) / step) + 1;
  const rows = Math.ceil((maxZ - minZ) / step) + 1;
  const seen = new Uint8Array(cols * rows);
  const key = (x: number, z: number) =>
    Math.round((x - minX) / step) + Math.round((z - minZ) / step) * cols;
  const q: [number, number][] = [[CP_SPAWN.x, CP_SPAWN.z]];
  seen[key(CP_SPAWN.x, CP_SPAWN.z)] = 1;
  for (let i = 0; i < q.length; i++) {
    const [x, z] = q[i]!;
    for (const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]] as const) {
      const nx = x + dx;
      const nz = z + dz;
      if (nx < minX || nx > maxX || nz < minZ || nz > maxZ) continue;
      const k = key(nx, nz);
      if (seen[k] || !coilPassWalkable(nx, nz)) continue;
      seen[k] = 1;
      q.push([nx, nz]);
    }
  }
  const reached = (x: number, z: number) => seen[key(x, z)] === 1;
  for (const g of CP_GATES) {
    const cx = (g.minX + g.maxX) / 2;
    const cz = (g.minZ + g.maxZ) / 2;
    assert.equal(coilPassWalkable(cx, cz), true, g.id);
    assert.equal(reached(cx, cz), true, g.id);
    assert.equal(coilPassGateSoftLevel(cx, cz), 8, g.id);
  }
});

test("coil pass road is named, dry, and the label sits in bounds", () => {
  const wet: string[] = [];
  for (const t of coilPassTrails()) {
    assert.equal(t.surface, "dirt");
    assert.ok(CP_ROAD_NAMES[t.id], t.id);
    for (let i = 1; i < t.points.length; i++) {
      const a = t.points[i - 1]!;
      const b = t.points[i]!;
      for (let s = 0; s <= 16; s++) {
        const u = s / 16;
        const x = a.x + (b.x - a.x) * u;
        const z = a.z + (b.z - a.z) * u;
        if (coilPassInOpenWater(x, z) || !coilPassWalkable(x, z)) wet.push(`${t.id} ${x.toFixed(1)},${z.toFixed(1)}`);
      }
    }
  }
  assert.deepEqual(wet, []);
  assert.equal(CP_MAP_LABELS.length, 1);
  assert.equal(CP_MAP_LABELS[0]!.text, "Switchback");
  assert.equal(CP_MAP_LABELS[0]!.kind, "landmark");
  for (const l of CP_MAP_LABELS) {
    assert.ok(l.x >= CP_BOUNDS.minX && l.x <= CP_BOUNDS.maxX);
    assert.ok(l.z >= CP_BOUNDS.minZ && l.z <= CP_BOUNDS.maxZ);
  }
  assert.equal(coilPassBiome(0, 8), "grass");
  assert.equal(coilPassBiome(20, 90), "mountain");
});

test("coil pass shoulder props stay under 300 and at least 6 m apart", () => {
  const props = coilPassProps();
  console.log(`coil_pass props ${props.length}`);
  assert.ok(props.length > 0 && props.length < 300, `props ${props.length}`);
  for (let i = 0; i < props.length; i++) {
    const a = props[i]!;
    assert.ok(a.kind === 15 || a.kind === 18, `kind ${a.kind}`);
    for (let j = i + 1; j < props.length; j++) {
      const b = props[j]!;
      assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= 6 - 1e-3);
    }
  }
});

test("coil pass bake is the area-sheet byte length", () => {
  const buf = bakeZoneGrid({
    bounds: CP_BOUNDS,
    biome: coilPassBiome,
    stand: coilPassStandHeight,
    water: coilPassWaterSurfaceY,
    openWater: coilPassInOpenWater,
    onBridge: coilPassOnBridge,
    walkable: coilPassWalkable,
    trails: coilPassTrails(),
    trailWidth: CP_TRAIL_WIDTH,
  });
  const cell = 0.5;
  const w = Math.ceil((CP_BOUNDS.maxX - CP_BOUNDS.minX) / cell) + 1;
  const h = Math.ceil((CP_BOUNDS.maxZ - CP_BOUNDS.minZ) / cell) + 1;
  assert.equal(w, 89);
  assert.equal(h, 361);
  assert.equal(buf.length, 24 + 4 * w * h);
  assert.equal(buf.toString("ascii", 0, 4), "BAZ1");
});

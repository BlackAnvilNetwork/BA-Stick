import assert from "node:assert/strict";
import test from "node:test";
import {
  CR_BOUNDS,
  CR_GATES,
  CR_MAP_LABELS,
  CR_ROAD_NAMES,
  CR_SPAWN,
  CR_TRAIL_WIDTH,
  coilRidgeBiome,
  coilRidgeGateSoftLevel,
  coilRidgeHeight,
  coilRidgeInOpenWater,
  coilRidgeOnBridge,
  coilRidgeStandHeight,
  coilRidgeTrails,
  coilRidgeWalkable,
  coilRidgeWaterSurfaceY,
} from "../../../packages/config/src/coil-ridge";
import { bakeZoneGrid } from "../scripts/bake-zones";
import { K } from "../scripts/bake-props";
import { coilRidgeProps } from "../scripts/zone-props/coil-ridge";

/** A point on the spiral arm at the given radius. Angle = radius × 0.15. */
function onArm(radius: number): { x: number; z: number } {
  const theta = radius * 0.15;
  return { x: radius * Math.cos(theta), z: 10 + radius * Math.sin(theta) };
}

test("coil ridge spawn is dry, the tongue is dry, and the spiral arm holds water", () => {
  assert.equal(coilRidgeWalkable(CR_SPAWN.x, CR_SPAWN.z), true);
  assert.equal(coilRidgeInOpenWater(CR_SPAWN.x, CR_SPAWN.z), false);
  assert.equal(coilRidgeOnBridge(CR_SPAWN.x, CR_SPAWN.z), false);
  assert.equal(CR_SPAWN.facing, 0);
  assert.equal(CR_TRAIL_WIDTH, 3.3);
  assert.ok(Math.abs(coilRidgeStandHeight(CR_SPAWN.x, CR_SPAWN.z) - 2.4) < 0.05);
  assert.equal(coilRidgeHeight(0, -80), coilRidgeStandHeight(0, -80));

  assert.equal(coilRidgeWalkable(0, -80), true);
  assert.equal(coilRidgeInOpenWater(0, -80), false);
  assert.ok(Math.abs(coilRidgeStandHeight(0, -80) - 2.4) < 0.05);

  const arm = onArm(50);
  assert.ok(arm.z > -50, `arm z ${arm.z}`);
  assert.ok(Math.abs(Math.hypot(arm.x, arm.z - 10) - 50) < 1e-6);
  assert.equal(coilRidgeInOpenWater(arm.x, arm.z), true);
  assert.equal(coilRidgeWalkable(arm.x, arm.z), false);
  assert.equal(coilRidgeWaterSurfaceY(arm.x, arm.z), 1);
  assert.ok(Math.abs(coilRidgeStandHeight(arm.x, arm.z) - (1 - 1.35)) < 1e-6);

  assert.equal(coilRidgeWalkable(0, 50), true);
  assert.equal(coilRidgeInOpenWater(0, 50), false);
  assert.equal(coilRidgeWalkable(0, 10), false);
});

test("coil ridge relief stays under 11.5 m", () => {
  let minY = Infinity;
  let maxY = -Infinity;
  let walk = 0;
  let n = 0;
  const { minX, maxX, minZ, maxZ } = CR_BOUNDS;
  for (let z = minZ; z <= maxZ; z += 4) {
    for (let x = minX; x <= maxX; x += 4) {
      const y = coilRidgeStandHeight(x, z);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      n++;
      if (coilRidgeWalkable(x, z)) walk++;
    }
  }
  const arm = onArm(50);
  minY = Math.min(minY, coilRidgeStandHeight(arm.x, arm.z));
  const crown = coilRidgeStandHeight(0, 10);
  maxY = Math.max(maxY, crown);
  assert.ok(crown <= 10.5 && crown > 10, `crown ${crown}`);
  assert.ok(minY >= -0.5 && maxY < 11.5, `relief ${minY}..${maxY}`);
  const frac = walk / n;
  console.log(`coil_ridge walkable fraction ${frac.toFixed(3)} (${walk}/${n})`);
  assert.ok(frac > 0.35 && frac < 0.6, `walkable fraction ${frac.toFixed(3)}`);
});

test("coil ridge flood from the tongue reaches the lip and the dry disc", () => {
  assert.deepEqual(
    CR_GATES.map((g) => ({
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
      { id: "tongue-lip", minX: -8, maxX: 8, minZ: -146, maxZ: -134, softLevel: 8, blocked: false, destZone: "coil_pass" },
    ],
  );

  const step = 4;
  const { minX, minZ, maxX, maxZ } = CR_BOUNDS;
  const cols = Math.ceil((maxX - minX) / step) + 1;
  const rows = Math.ceil((maxZ - minZ) / step) + 1;
  const seen = new Uint8Array(cols * rows);
  const key = (x: number, z: number) =>
    Math.round((x - minX) / step) + Math.round((z - minZ) / step) * cols;
  const q: [number, number][] = [[CR_SPAWN.x, CR_SPAWN.z]];
  seen[key(CR_SPAWN.x, CR_SPAWN.z)] = 1;
  for (let i = 0; i < q.length; i++) {
    const [x, z] = q[i]!;
    for (const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]] as const) {
      const nx = x + dx;
      const nz = z + dz;
      if (nx < minX || nx > maxX || nz < minZ || nz > maxZ) continue;
      const k = key(nx, nz);
      if (seen[k] || !coilRidgeWalkable(nx, nz)) continue;
      seen[k] = 1;
      q.push([nx, nz]);
    }
  }
  const reached = (x: number, z: number) => seen[key(x, z)] === 1;
  for (const g of CR_GATES) {
    const cx = (g.minX + g.maxX) / 2;
    const cz = (g.minZ + g.maxZ) / 2;
    assert.equal(coilRidgeWalkable(cx, cz), true, g.id);
    assert.equal(coilRidgeInOpenWater(cx, cz), false, g.id);
    assert.equal(reached(cx, cz), true, g.id);
    assert.equal(coilRidgeGateSoftLevel(cx, cz), 8, g.id);
  }
  assert.equal(coilRidgeWalkable(0, 50), true);
  assert.equal(coilRidgeInOpenWater(0, 50), false);
  assert.equal(reached(0, 50), true);
});

test("coil ridge tongue track is named and dry, and labels sit in bounds", () => {
  const wet: string[] = [];
  for (const t of coilRidgeTrails()) {
    assert.equal(t.surface, "dirt");
    assert.ok(CR_ROAD_NAMES[t.id], t.id);
    for (let i = 1; i < t.points.length; i++) {
      const a = t.points[i - 1]!;
      const b = t.points[i]!;
      for (let s = 0; s <= 16; s++) {
        const u = s / 16;
        const x = a.x + (b.x - a.x) * u;
        const z = a.z + (b.z - a.z) * u;
        if (coilRidgeInOpenWater(x, z) || !coilRidgeWalkable(x, z)) wet.push(`${t.id} ${x.toFixed(1)},${z.toFixed(1)}`);
      }
    }
  }
  assert.deepEqual(wet, []);
  const labels = [...CR_MAP_LABELS];
  assert.deepEqual(
    labels.map((l) => l.text),
    ["South Tongue", "Spiral Water", "Crown"],
  );
  assert.deepEqual(
    labels.map((l) => l.kind),
    ["area", "water", "landmark"],
  );
  for (const l of labels) {
    assert.ok(l.x >= CR_BOUNDS.minX && l.x <= CR_BOUNDS.maxX);
    assert.ok(l.z >= CR_BOUNDS.minZ && l.z <= CR_BOUNDS.maxZ);
  }
  assert.equal(coilRidgeBiome(0, 10), "mountain");
});

test("coil ridge props are one peak plus meadow trees under the cap", () => {
  const props = coilRidgeProps();
  const peaks = props.filter((p) => p.kind === K.peak);
  const trees = props.filter((p) => p.kind === K.pine || p.kind === K.spruce);
  console.log(`coil_ridge props ${props.length} trees ${trees.length}`);
  assert.equal(peaks.length, 1);
  assert.equal(peaks[0]!.x, 0);
  assert.equal(peaks[0]!.z, 10);
  assert.ok(props.length > 1 && props.length < 2500, `props ${props.length}`);
  assert.equal(props.length, peaks.length + trees.length);
  for (const t of trees) {
    assert.equal(coilRidgeWalkable(t.x, t.z), true);
    assert.equal(coilRidgeInOpenWater(t.x, t.z), false);
    assert.ok(coilRidgeStandHeight(t.x, t.z) < 6);
    assert.equal(coilRidgeBiome(t.x, t.z), "meadow");
  }
  for (let i = 0; i < trees.length; i++) {
    const a = trees[i]!;
    for (let j = i + 1; j < trees.length; j++) {
      const b = trees[j]!;
      if (Math.hypot(a.x - b.x, a.z - b.z) < 8 - 1e-3) {
        assert.fail(`trees closer than 8 m at ${a.x},${a.z} and ${b.x},${b.z}`);
      }
    }
  }
});

test("coil ridge bake is the area-sheet byte length", () => {
  const buf = bakeZoneGrid({
    bounds: CR_BOUNDS,
    biome: coilRidgeBiome,
    stand: coilRidgeStandHeight,
    water: coilRidgeWaterSurfaceY,
    openWater: coilRidgeInOpenWater,
    onBridge: coilRidgeOnBridge,
    walkable: coilRidgeWalkable,
    trails: coilRidgeTrails(),
    trailWidth: CR_TRAIL_WIDTH,
  });
  const cell = 0.5;
  const w = Math.ceil((CR_BOUNDS.maxX - CR_BOUNDS.minX) / cell) + 1;
  const h = Math.ceil((CR_BOUNDS.maxZ - CR_BOUNDS.minZ) / cell) + 1;
  assert.equal(w, 481);
  assert.equal(h, 521);
  assert.equal(buf.length, 24 + 4 * w * h);
  assert.equal(buf.toString("ascii", 0, 4), "BAZ1");
});

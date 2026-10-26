import { naturalSample } from "../scripts/natural-edges";
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
  CR_BRIDGE,
  CR_TARN,
  CR_RUINS,
  coilRidgeInShallows,
} from "../../../packages/config/src/coil-ridge";
import { bakeZoneGrid } from "../scripts/bake-zones";
import { K } from "../scripts/bake-props";
import { coilRidgeProps } from "../scripts/zone-props/coil-ridge";

test("coil ridge (the Broken Stair): spawn dry on the apron, tarn has a wadeable shelf and a deep core", () => {
  assert.equal(coilRidgeWalkable(CR_SPAWN.x, CR_SPAWN.z), true);
  assert.equal(coilRidgeInOpenWater(CR_SPAWN.x, CR_SPAWN.z), false);
  assert.equal(coilRidgeOnBridge(CR_SPAWN.x, CR_SPAWN.z), false);
  assert.equal(CR_SPAWN.facing, 0);
  assert.equal(CR_TRAIL_WIDTH, 3.3);
  assert.ok(Math.abs(coilRidgeStandHeight(CR_SPAWN.x, CR_SPAWN.z) - 2.61) < 0.1);
  assert.equal(coilRidgeHeight(0, -80), coilRidgeStandHeight(0, -80));

  // deep tarn core: water, not walkable, more than 2 m deep
  assert.equal(coilRidgeInOpenWater(CR_TARN.x, CR_TARN.z), true);
  assert.equal(coilRidgeWalkable(CR_TARN.x, CR_TARN.z), false);
  const s = coilRidgeWaterSurfaceY(CR_TARN.x, CR_TARN.z)!;
  assert.ok(s - coilRidgeStandHeight(CR_TARN.x, CR_TARN.z) > 2, "tarn core depth");
  // every walkable wet cell is shallow (<= 0.6 m)
  let wade = 0;
  const { minX, maxX, minZ, maxZ } = CR_BOUNDS;
  for (let z = minZ; z <= maxZ; z += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const w = coilRidgeWaterSurfaceY(x, z);
      if (w == null || !coilRidgeWalkable(x, z) || coilRidgeOnBridge(x, z)) continue;
      wade++;
      assert.ok(w - coilRidgeStandHeight(x, z) <= 0.61, `deep walkable at ${x},${z}`);
    }
  }
  assert.ok(wade > 50, `wadeable cells ${wade}`);
  assert.equal(coilRidgeInShallows(CR_SPAWN.x, CR_SPAWN.z), false);
});

test("coil ridge walkable relief stays under 11.5 m and the bridge spans the race", () => {
  let minY = Infinity;
  let maxY = -Infinity;
  let walk = 0;
  let n = 0;
  const { minX, maxX, minZ, maxZ } = CR_BOUNDS;
  for (let z = minZ; z <= maxZ; z += 4) {
    for (let x = minX; x <= maxX; x += 4) {
      const y = coilRidgeStandHeight(x, z);
      minY = Math.min(minY, y);
      n++;
      if (coilRidgeWalkable(x, z)) {
        walk++;
        maxY = Math.max(maxY, y);
      }
    }
  }
  assert.ok(minY >= -0.5 && maxY < 11.5, `relief ${minY}..${maxY}`);
  const frac = walk / n;
  console.log(`coil_ridge walkable fraction ${frac.toFixed(3)} (${walk}/${n})`);
  assert.ok(frac > 0.3 && frac < 0.7, `walkable fraction ${frac.toFixed(3)}`);
  assert.equal(coilRidgeOnBridge(CR_BRIDGE.x, CR_BRIDGE.z), true);
  assert.equal(coilRidgeWalkable(CR_BRIDGE.x, CR_BRIDGE.z), true);
  for (const sgn of [-1, 1]) {
    const x = CR_BRIDGE.x + sgn * CR_BRIDGE.dir.x * (CR_BRIDGE.span / 2 + 1.5);
    const z = CR_BRIDGE.z + sgn * CR_BRIDGE.dir.z * (CR_BRIDGE.span / 2 + 1.5);
    assert.equal(coilRidgeWalkable(x, z), true, `bank ${sgn}`);
    assert.equal(coilRidgeInOpenWater(x, z), false, `bank ${sgn}`);
  }
});

test("coil ridge flood from the tongue reaches the lip, the shelf and both bridge banks", () => {
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
  for (const r of CR_RUINS) assert.equal(reached(Math.round(r.x / 4) * 4, Math.round(r.z / 4) * 4) || reached(Math.round(r.x / 4) * 4 + 4, Math.round(r.z / 4) * 4), true, r.id);
});

test("coil ridge trails are named and dry, and labels sit in bounds", () => {
  const wet: string[] = [];
  for (const t of coilRidgeTrails()) {
    assert.ok(CR_ROAD_NAMES[t.id], t.id);
    for (let i = 1; i < t.points.length; i++) {
      const a = t.points[i - 1]!;
      const b = t.points[i]!;
      for (let s = 0; s <= 16; s++) {
        const u = s / 16;
        const x = a.x + (b.x - a.x) * u;
        const z = a.z + (b.z - a.z) * u;
        if ((coilRidgeInOpenWater(x, z) && !coilRidgeOnBridge(x, z)) || !coilRidgeWalkable(x, z)) wet.push(`${t.id} ${x.toFixed(1)},${z.toFixed(1)}`);
      }
    }
  }
  assert.deepEqual(wet, []);
  const labels = [...CR_MAP_LABELS];
  assert.ok(labels.some((l) => l.text === "Broken Stair"));
  assert.ok(labels.some((l) => l.text === "Mirror Tarn" && l.kind === "water"));
  for (const l of labels) {
    assert.ok(l.x >= CR_BOUNDS.minX && l.x <= CR_BOUNDS.maxX);
    assert.ok(l.z >= CR_BOUNDS.minZ && l.z <= CR_BOUNDS.maxZ);
  }
});

test("coil ridge props: one bridge, ruin stones, trees on dry meadow 8 m apart", () => {
  const props = coilRidgeProps();
  const bridges = props.filter((p) => p.kind === K.bridge);
  const trees = props.filter((p) => p.kind === K.pine || p.kind === K.spruce);
  console.log(`coil_ridge props ${props.length} trees ${trees.length}`);
  assert.equal(bridges.length, 1);
  assert.equal(props.filter((p) => p.kind === K.peak).length, 0);
  assert.ok(props.length > 10 && props.length < 2500, `props ${props.length}`);
  for (const t of props.filter((p) => p.kind !== K.bridge)) {
    assert.equal(coilRidgeWalkable(t.x, t.z), true);
    assert.equal(coilRidgeInOpenWater(t.x, t.z), false);
  }
  for (const t of trees) assert.equal(naturalSample(coilRidgeBiome, t.x, t.z), "meadow"); // warped ground biome
  for (let i = 0; i < trees.length; i++) {
    for (let j = i + 1; j < trees.length; j++) {
      if (Math.hypot(trees[i]!.x - trees[j]!.x, trees[i]!.z - trees[j]!.z) < 8 - 1e-3) assert.fail("trees closer than 8 m");
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

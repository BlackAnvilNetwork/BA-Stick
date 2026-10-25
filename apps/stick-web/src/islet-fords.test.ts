import assert from "node:assert/strict";
import test from "node:test";
import { K } from "../scripts/bake-props";
import { isletFordsProps } from "../scripts/zone-props/islet-fords";
import { bakeZoneGrid } from "../scripts/bake-zones";
import {
  IF_BED,
  IF_BOUNDS,
  IF_GATES,
  IF_MAP_LABELS,
  IF_ROAD_NAMES,
  IF_SPAWN,
  IF_SURFACE,
  IF_TRAIL_WIDTH,
  isletFordsBiome,
  isletFordsGateSoftLevel,
  isletFordsInOpenWater,
  isletFordsOnBridge,
  isletFordsOnFord,
  isletFordsStandHeight,
  isletFordsTrails,
  isletFordsWalkable,
  isletFordsWaterSurfaceY,
} from "../../../packages/config/src/islet-fords";

const FORD_MID = { x: 58, z: 2 };
const CHANNEL = { x: 58, z: 18 };

test("islet fords spawn is dry, the ford is dry, and the channel off it is water", () => {
  assert.equal(IF_SPAWN.x, 24);
  assert.equal(IF_SPAWN.z, 0);
  assert.equal(IF_SPAWN.facing, 0);
  assert.equal(IF_TRAIL_WIDTH, 3.3);
  assert.equal(isletFordsWalkable(IF_SPAWN.x, IF_SPAWN.z), true);
  assert.equal(isletFordsInOpenWater(IF_SPAWN.x, IF_SPAWN.z), false);
  assert.equal(isletFordsOnBridge(IF_SPAWN.x, IF_SPAWN.z), false);

  assert.equal(isletFordsOnFord(FORD_MID.x, FORD_MID.z), true);
  assert.equal(isletFordsWalkable(FORD_MID.x, FORD_MID.z), true);
  assert.equal(isletFordsInOpenWater(FORD_MID.x, FORD_MID.z), false);
  assert.equal(isletFordsBiome(FORD_MID.x, FORD_MID.z), "riverbank");
  assert.equal(isletFordsWaterSurfaceY(FORD_MID.x, FORD_MID.z), null);
  const crest = isletFordsStandHeight(FORD_MID.x, FORD_MID.z);
  assert.ok(Math.abs(crest - 0.9) < 0.05, `crest ${crest}`);
  const pad = isletFordsStandHeight(16, 0);
  assert.ok(Math.abs(pad - 1.6) < 0.05, `pad ${pad}`);

  assert.equal(isletFordsInOpenWater(CHANNEL.x, CHANNEL.z), true);
  assert.equal(isletFordsWalkable(CHANNEL.x, CHANNEL.z), false);
  assert.equal(isletFordsBiome(CHANNEL.x, CHANNEL.z), "river");
  assert.equal(isletFordsWaterSurfaceY(CHANNEL.x, CHANNEL.z), IF_SURFACE);
  const bed = isletFordsStandHeight(CHANNEL.x, CHANNEL.z);
  assert.ok(Math.abs(bed - IF_BED) < 0.05, `bed ${bed}`);
  for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2]] as const) {
    assert.equal(isletFordsInOpenWater(CHANNEL.x + dx, CHANNEL.z + dz), true, `${dx},${dz}`);
    assert.equal(isletFordsWalkable(CHANNEL.x + dx, CHANNEL.z + dz), false);
  }

  assert.equal(isletFordsWalkable(58, 32), false);
  assert.equal(isletFordsBiome(58, 32), "mountain");
  assert.equal(isletFordsInOpenWater(58, 32), false);

  assert.deepEqual(
    IF_GATES.map((g) => [g.id, g.minX, g.maxX, g.minZ, g.maxZ, g.softLevel, g.blocked, g.destZone]),
    [
      ["west-lip", 2, 14, -6, 6, 8, false, "ring_ward"],
      ["east-lip", 180, 192, -8, 4, 8, false, "green_reach"],
    ],
  );
  assert.equal(isletFordsGateSoftLevel(8, 0), 8);
  assert.equal(isletFordsGateSoftLevel(186, -2), 8);
  assert.equal(isletFordsGateSoftLevel(24, 0), null);
});

test("islet fords relief stays inside the sheet", () => {
  let minY = Infinity;
  let maxY = -Infinity;
  let walk = 0;
  let n = 0;
  const { minX, maxX, minZ, maxZ } = IF_BOUNDS;
  for (let z = minZ; z <= maxZ; z += 4) {
    for (let x = minX; x <= maxX; x += 4) {
      const y = isletFordsStandHeight(x, z);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      n++;
      if (isletFordsWalkable(x, z)) walk++;
    }
  }
  assert.ok(minY >= -1.35 && minY < -0.5, `relief min ${minY}`);
  assert.ok(maxY < 3 && maxY > 2, `relief max ${maxY}`);
  const frac = walk / n;
  console.log(`islet_fords walkable fraction ${frac.toFixed(3)} (${walk}/${n})`);
  assert.ok(frac > 0.15 && frac < 0.35, `walkable fraction ${frac.toFixed(3)}`);
});

test("islet fords gates are reachable from the west islet spawn", () => {
  const step = 2;
  const { minX, minZ, maxX, maxZ } = IF_BOUNDS;
  const cols = Math.ceil((maxX - minX) / step) + 1;
  const rows = Math.ceil((maxZ - minZ) / step) + 1;
  const seen = new Uint8Array(cols * rows);
  const key = (x: number, z: number) =>
    Math.round((x - minX) / step) + Math.round((z - minZ) / step) * cols;
  const q: [number, number][] = [[IF_SPAWN.x, IF_SPAWN.z]];
  seen[key(IF_SPAWN.x, IF_SPAWN.z)] = 1;
  for (let i = 0; i < q.length; i++) {
    const [x, z] = q[i]!;
    for (const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]] as const) {
      const nx = x + dx;
      const nz = z + dz;
      if (nx < minX || nx > maxX || nz < minZ || nz > maxZ) continue;
      const k = key(nx, nz);
      if (seen[k] || !isletFordsWalkable(nx, nz)) continue;
      seen[k] = 1;
      q.push([nx, nz]);
    }
  }
  const reached = (x: number, z: number) => seen[key(x, z)] === 1;
  for (const g of IF_GATES) {
    const cx = (g.minX + g.maxX) / 2;
    const cz = (g.minZ + g.maxZ) / 2;
    assert.equal(g.blocked, false, g.id);
    assert.equal(isletFordsWalkable(cx, cz), true, g.id);
    assert.equal(reached(cx, cz), true, g.id);
  }
});

test("islet fords trail stays dry on the fords and every road is named", () => {
  const wet: string[] = [];
  for (const t of isletFordsTrails()) {
    assert.equal(t.surface, "dirt");
    assert.ok(IF_ROAD_NAMES[t.id], t.id);
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
          if (!isletFordsWalkable(px, pz) || isletFordsInOpenWater(px, pz)) {
            wet.push(`${t.id} ${px.toFixed(1)},${pz.toFixed(1)}`);
          }
        }
      }
    }
  }
  assert.deepEqual(wet, []);
  for (const l of IF_MAP_LABELS) {
    assert.ok(l.kind === "area", l.text);
    assert.ok(l.x >= IF_BOUNDS.minX && l.x <= IF_BOUNDS.maxX);
    assert.ok(l.z >= IF_BOUNDS.minZ && l.z <= IF_BOUNDS.maxZ);
  }
});

test("islet fords props stay under the budget and on the right ground", () => {
  const props = isletFordsProps();
  assert.ok(props.length < 400, `props ${props.length}`);
  let reeds = 0;
  let rocks = 0;
  let pines = 0;
  let leans = 0;
  for (const p of props) {
    assert.ok(p.x >= IF_BOUNDS.minX && p.x <= IF_BOUNDS.maxX);
    assert.ok(p.z >= IF_BOUNDS.minZ && p.z <= IF_BOUNDS.maxZ);
    if (p.kind === K.reed) {
      reeds++;
      assert.equal(isletFordsInOpenWater(p.x, p.z), true);
    } else if (p.kind === K.rock) {
      rocks++;
      assert.equal(isletFordsWalkable(p.x, p.z), true);
    } else if (p.kind === K.pine) {
      pines++;
      assert.equal(isletFordsWalkable(p.x, p.z), true);
      assert.equal(isletFordsBiome(p.x, p.z), "grass");
    } else if (p.kind === K.leanTo) {
      leans++;
      assert.equal(isletFordsWalkable(p.x, p.z), true);
      assert.ok(Math.hypot(p.x - 100, p.z - 4) < 18);
    } else {
      assert.fail(`unexpected kind ${p.kind}`);
    }
  }
  assert.equal(leans, 1);
  assert.ok(reeds > 8, `reeds ${reeds}`);
  assert.ok(rocks > 8, `rocks ${rocks}`);
  assert.ok(pines >= 3 && pines <= 24, `pines ${pines}`);
  console.log(`islet_fords props ${props.length} (reeds ${reeds}, rocks ${rocks}, pines ${pines})`);
});

test("islet fords bake is the area-sheet byte length", () => {
  const buf = bakeZoneGrid({
    bounds: IF_BOUNDS,
    biome: isletFordsBiome,
    stand: isletFordsStandHeight,
    water: isletFordsWaterSurfaceY,
    openWater: isletFordsInOpenWater,
    onBridge: isletFordsOnBridge,
    walkable: isletFordsWalkable,
    trails: isletFordsTrails(),
    trailWidth: IF_TRAIL_WIDTH,
  });
  const cell = 0.5;
  const w = Math.ceil((IF_BOUNDS.maxX - IF_BOUNDS.minX) / cell) + 1;
  const h = Math.ceil((IF_BOUNDS.maxZ - IF_BOUNDS.minZ) / cell) + 1;
  assert.equal(w, 441);
  assert.equal(h, 145);
  assert.equal(buf.length, 24 + 4 * w * h);
  assert.equal(buf.toString("ascii", 0, 4), "BAZ1");
});

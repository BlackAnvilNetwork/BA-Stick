import assert from "node:assert/strict";
import test from "node:test";
import {
  FB_GATES,
  HR_BOUNDS,
  HR_GATES,
  HR_SPAWN,
  PH_ASH_ROAD,
  applyTravel,
  forestBasinWalkable,
  hollowRoadStandHeight,
  hollowRoadWalkable,
  paleHollowWalkable,
  travelAt,
  ZONE_FIELDS,
} from "@bellgrave/config";
import { bakeZoneGrid } from "../scripts/bake-zones";

test("ash road walks onto hollow road and does not bounce", () => {
  assert.equal(PH_ASH_ROAD.blocked, false);
  assert.equal(paleHollowWalkable(0, 480), true);
  const step = travelAt("pale_hollow", 0, 480);
  assert.deepEqual(
    step && { zoneId: step.zoneId, x: step.x, z: step.z },
    { zoneId: "hollow_road", x: 0, z: 22 },
  );
  assert.equal(hollowRoadWalkable(0, 22), true);
  assert.equal(travelAt("hollow_road", 0, 22), null);
});

test("hollow road south returns to pale hollow outside the ash road", () => {
  const step = travelAt("hollow_road", 0, 4);
  assert.equal(step?.zoneId, "pale_hollow");
  assert.equal(paleHollowWalkable(step!.x, step!.z), true);
  assert.ok(step!.z < PH_ASH_ROAD.minZ);
  assert.equal(travelAt("pale_hollow", step!.x, step!.z), null);
});

test("hollow road north enters forest basin outside the south lip", () => {
  const step = travelAt("hollow_road", 0, 155);
  assert.equal(step?.zoneId, "forest_basin");
  assert.equal(forestBasinWalkable(step!.x, step!.z), true);
  const lip = FB_GATES.find((g) => g.id === "south-lip")!;
  assert.ok(step!.z > lip.maxZ);
  const back = travelAt("forest_basin", (lip.minX + lip.maxX) / 2, (lip.minZ + lip.maxZ) / 2);
  assert.equal(back?.zoneId, "hollow_road");
  assert.equal(hollowRoadWalkable(back!.x, back!.z), true);
  const north = HR_GATES.find((g) => g.id === "north-lip")!;
  assert.ok(back!.z < north.minZ);
  assert.equal(travelAt("hollow_road", back!.x, back!.z), null);
});

test("hollow road relief stays low and both lips are reachable", () => {
  let minY = Infinity;
  let maxY = -Infinity;
  for (let z = HR_BOUNDS.minZ; z <= HR_BOUNDS.maxZ; z += 4) {
    for (let x = HR_BOUNDS.minX; x <= HR_BOUNDS.maxX; x += 4) {
      const y = hollowRoadStandHeight(x, z);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  assert.ok(minY >= -0.5 && maxY <= 3.2, `relief ${minY}..${maxY}`);
  const step = 2;
  const seen = new Set<string>();
  const q: [number, number][] = [[HR_SPAWN.x, HR_SPAWN.z]];
  seen.add(`${HR_SPAWN.x},${HR_SPAWN.z}`);
  for (let i = 0; i < q.length; i++) {
    const [x, z] = q[i]!;
    for (const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]] as const) {
      const nx = x + dx;
      const nz = z + dz;
      const k = `${nx},${nz}`;
      if (seen.has(k) || !hollowRoadWalkable(nx, nz)) continue;
      seen.add(k);
      q.push([nx, nz]);
    }
  }
  for (const g of HR_GATES) {
    const cx = Math.round((g.minX + g.maxX) / 2 / step) * step;
    const cz = Math.round((g.minZ + g.maxZ) / 2 / step) * step;
    assert.equal(hollowRoadWalkable(cx, cz), true, g.id);
    assert.equal(seen.has(`${cx},${cz}`), true, g.id);
  }
});

test("hollow road bake is the area-sheet byte length", () => {
  const spec = ZONE_FIELDS.hollow_road!;
  const buf = bakeZoneGrid({
    bounds: spec.bounds,
    biome: spec.biome,
    stand: spec.stand,
    water: spec.water,
    openWater: spec.openWater,
    onBridge: spec.onBridge,
    walkable: spec.walkable,
    trails: spec.trails(),
    trailWidth: spec.trailWidth,
  });
  assert.equal(buf.length, 24 + 4 * 73 * 321);
  assert.equal(buf.toString("ascii", 0, 4), "BAZ1");
});

test("applyTravel moves a body off the ash road", () => {
  const body = { zoneId: "pale_hollow", x: 0, z: 480, facing: 0 };
  assert.equal(applyTravel(body), true);
  assert.equal(body.zoneId, "hollow_road");
  assert.equal(applyTravel(body), false);
});

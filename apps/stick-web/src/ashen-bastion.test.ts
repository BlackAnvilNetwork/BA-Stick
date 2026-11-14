import assert from "node:assert/strict";
import test from "node:test";
import {
  AB_BOUNDS,
  AB_GATES,
  AB_KEEP_TOP_Y,
  AB_RAMPART_Y,
  AB_SAMPLE_HOUSE,
  AB_SPAWN,
  AB_YARD_Y,
  ashenBastionBiome,
  ashenBastionOnBridge,
  ashenBastionStandHeight,
  ashenBastionWalkable,
} from "../../../packages/config/src/ashen-bastion.ts";
import { ashenBastionProps } from "../scripts/zone-props/ashen-bastion.ts";
import { bakeZoneGrid } from "../scripts/bake-zones";
import { ZONE_FIELDS } from "../../../packages/config/src/zone-fields.ts";

test("ashen bastion spawn is walkable yard", () => {
  assert.equal(ashenBastionWalkable(AB_SPAWN.x, AB_SPAWN.z), true);
  assert.ok(ashenBastionStandHeight(AB_SPAWN.x, AB_SPAWN.z) >= AB_YARD_Y - 0.05);
  assert.equal(AB_SPAWN.facing, Math.PI);
});

test("ashen bastion ramparts, bridges, and keep pads are walkable", () => {
  assert.equal(ashenBastionWalkable(-52, -12), true); // south-west rampart
  assert.ok(ashenBastionStandHeight(-52, -12) >= AB_RAMPART_Y - 0.05);
  assert.equal(ashenBastionOnBridge(-55, 26), true);
  assert.equal(ashenBastionWalkable(-55, 26), true);
  assert.equal(ashenBastionWalkable(0, 40), true); // keep top
  assert.ok(ashenBastionStandHeight(0, 40) >= AB_KEEP_TOP_Y - 0.2);
  assert.equal(ashenBastionBiome(0, -6), "hub_indoor");
});

test("ashen bastion flood-fill from spawn reaches key pads", () => {
  const step = 2;
  const { minX, minZ, maxX, maxZ } = AB_BOUNDS;
  const cols = Math.ceil((maxX - minX) / step) + 1;
  const rows = Math.ceil((maxZ - minZ) / step) + 1;
  const seen = new Uint8Array(cols * rows);
  const key = (x: number, z: number) =>
    Math.round((x - minX) / step) + Math.round((z - minZ) / step) * cols;
  const q: [number, number][] = [[AB_SPAWN.x, AB_SPAWN.z]];
  seen[key(AB_SPAWN.x, AB_SPAWN.z)] = 1;
  for (let i = 0; i < q.length; i++) {
    const [x, z] = q[i]!;
    for (const [dx, dz] of [
      [step, 0],
      [-step, 0],
      [0, step],
      [0, -step],
    ] as const) {
      const nx = x + dx;
      const nz = z + dz;
      if (nx < minX || nx > maxX || nz < minZ || nz > maxZ) continue;
      if (!ashenBastionWalkable(nx, nz)) continue;
      const k = key(nx, nz);
      if (seen[k]) continue;
      seen[k] = 1;
      q.push([nx, nz]);
    }
  }
  for (const g of AB_GATES) {
    const cx = (g.minX + g.maxX) / 2;
    const cz = (g.minZ + g.maxZ) / 2;
    assert.equal(ashenBastionWalkable(cx, cz), true, `gate ${g.id} walkable`);
    assert.equal(seen[key(cx, cz)], 1, `gate ${g.id} reachable`);
  }
  assert.equal(seen[key(0, 18)], 1, "courtyard center reachable");
  assert.equal(seen[key(-52, -12)], 1, "rampart reachable");
  assert.equal(seen[key(AB_SAMPLE_HOUSE.x, AB_SAMPLE_HOUSE.z)], 1, "house pad reachable");
  assert.equal(seen[key(0, 40)], 1, "keep top reachable");
});

test("ashen bastion bake + props", () => {
  const field = ZONE_FIELDS.ashen_bastion!;
  const buf = bakeZoneGrid({
    bounds: field.bounds,
    biome: field.biome,
    stand: field.stand,
    water: field.water,
    openWater: field.openWater,
    onBridge: field.onBridge,
    walkable: field.walkable,
    trails: field.trails(),
    trailWidth: field.trailWidth,
  });
  const w = Math.ceil((AB_BOUNDS.maxX - AB_BOUNDS.minX) / 0.5) + 1;
  const h = Math.ceil((AB_BOUNDS.maxZ - AB_BOUNDS.minZ) / 0.5) + 1;
  assert.equal(w, 289);
  assert.equal(h, 225);
  assert.equal(buf.length, 24 + 4 * w * h);
  const props = ashenBastionProps();
  assert.ok(props.length >= 8, `props ${props.length}`);
});

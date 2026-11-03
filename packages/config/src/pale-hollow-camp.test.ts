import { test } from "node:test";
import assert from "node:assert/strict";
import { PH_START_SPAWN as CAMP_SPAWN, PH_START_HERALD, PH_WARP_CIRCLES as CAMP_RINGS } from "./pale-hollow-camp";
import { PH_START_SPAWN, PH_WARP_CIRCLES } from "./warp-unlocks";
import { PH_HUB_NPCS } from "./pale-hollow";

test("Emberwatch terrain data matches the merged spawn and warp wiring", () => {
  assert.deepEqual({ ...CAMP_SPAWN }, { ...PH_START_SPAWN });
  for (const r of PH_WARP_CIRCLES) {
    const c = CAMP_RINGS.find((x) => x.id === r.id);
    assert.ok(c, r.id);
    assert.equal(c.x, r.x); assert.equal(c.z, r.z); assert.equal(c.r, r.r);
  }
  const herald = PH_HUB_NPCS.find((n) => n.id === "npc-ph-herald")!;
  assert.equal(herald.x, PH_START_HERALD.x); assert.equal(herald.z, PH_START_HERALD.z);
});

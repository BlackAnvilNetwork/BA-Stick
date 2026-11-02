import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PH_HUB_SPAWN, PH_OUTDOOR_SPAWN } from "./pale-hollow";
import { PH_WARP_CIRCLES, PH_WARP_HUB_EXCEPTIONS, warpCircleById, warpCircleHitsHub } from "./warp-unlocks";

describe("warp circles and the Scout Gate room", () => {
  it("allows only the named rings to sit inside the hub rectangle", () => {
    const exceptions = new Set<string>(PH_WARP_HUB_EXCEPTIONS);
    for (const id of PH_WARP_HUB_EXCEPTIONS) {
      assert.ok(warpCircleById(id), id);
    }
    let overlaps = 0;
    for (const circle of PH_WARP_CIRCLES) {
      if (!warpCircleHitsHub(circle)) continue;
      overlaps += 1;
      assert.equal(exceptions.has(circle.id), true, circle.id);
    }
    assert.equal(overlaps, 1);
    assert.equal(warpCircleHitsHub(warpCircleById("warp-mayflower")!), true);
  });

  it("keeps the Mayflower Ring clear of the Scout Gate spawn and other spawns (exception rationale)", () => {
    const ring = warpCircleById("warp-mayflower")!;
    for (const [id, p] of [["hub-spawn", PH_HUB_SPAWN], ["out-spawn", PH_OUTDOOR_SPAWN]] as const) {
      const d = Math.hypot(p.x - ring.x, p.z - ring.z);
      assert.ok(d >= ring.r + 1.5, `${id} is ${d.toFixed(2)} m from the Mayflower Ring`);
    }
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FB_WARP_SITES } from "./forest-basin-features";
import {
  PH_WARP_CIRCLES,
  PH_WARP_HUB_EXCEPTIONS,
  reachWarp,
  warpCircleAt,
  warpCircleById,
  warpCircleHitsHub,
} from "./warp-unlocks";

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

  it("opens the Kettle, Scraped and Spurgate rings only inside Forest Basin", () => {
    for (const site of FB_WARP_SITES) {
      const ring = warpCircleById(site.id);
      assert.ok(ring, site.id);
      assert.equal(ring.zoneId, "forest_basin");
      assert.equal(ring.name.startsWith("the "), false, ring.name);
      assert.equal(warpCircleAt(site.x, site.z, "pale_hollow"), undefined);
      const opened = reachWarp([], site.x, site.z, "forest_basin");
      assert.equal(opened.added, site.id);
      assert.equal(reachWarp([], site.x, site.z).added, null);
    }
  });
});

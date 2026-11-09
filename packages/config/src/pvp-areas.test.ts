import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ASH_PIT,
  PVP_BOUNTY_WEI,
  cappedMainLevel,
  cappedSubjobLevel,
  pvpAreaAt,
} from "./pvp-areas";

describe("pvp areas", () => {
  it("Ash Pit is level-30 PvP with 1e18 bounty", () => {
    assert.equal(ASH_PIT.pvp, true);
    assert.equal(ASH_PIT.levelCap, 30);
    assert.equal(PVP_BOUNTY_WEI, "1000000000000000000");
    assert.ok(pvpAreaAt(-60, -5)?.id === "ash_pit");
    assert.ok(pvpAreaAt(ASH_PIT.spawn.x, ASH_PIT.spawn.z)?.id === "ash_pit");
    assert.ok(pvpAreaAt(-60, -5, "pale_hollow")?.id === "ash_pit");
    assert.equal(pvpAreaAt(-60, -5, "forest_basin"), undefined);
    assert.equal(pvpAreaAt(ASH_PIT.spawn.x, ASH_PIT.spawn.z, "forest_basin"), undefined);
    assert.equal(pvpAreaAt(0, 0), undefined);
  });

  it("caps main and support levels", () => {
    assert.equal(cappedMainLevel(50, 30), 30);
    assert.equal(cappedMainLevel(20, 30), 20);
    assert.equal(cappedSubjobLevel(50, 30), 15);
    assert.equal(cappedSubjobLevel(8, 30), 0);
  });

  it("pvpAreaAt is xz + zoneId only — no 3D height axis", () => {
    const src = pvpAreaAt.toString();
    assert.equal(/\bheight\b/.test(src), false);
    assert.match(src, /\bx\b/);
    assert.match(src, /\bz\b/);
    assert.match(src, /zoneId/);
    // Same xz in Pale Hollow is the pit; another zone is not. Height is ignored.
    assert.ok(pvpAreaAt(ASH_PIT.spawn.x, ASH_PIT.spawn.z, "pale_hollow"));
    assert.equal(pvpAreaAt(ASH_PIT.spawn.x, ASH_PIT.spawn.z, "forest_basin"), undefined);
  });
});

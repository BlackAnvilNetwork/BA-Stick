import assert from "node:assert/strict";
import test from "node:test";
import {
  PH_HUB_SPAWN,
  PH_START_SPAWN,
  paleHollowWalkable,
  reachWarp,
  respawnStand,
} from "@bellgrave/config";
import { trySetRespawn, tryUseWarp } from "./warp-progress";

test("new characters start at Emberwatch, facing east, on dry ground", () => {
  assert.equal(PH_START_SPAWN.x, -53);
  assert.equal(PH_START_SPAWN.z, 297);
  assert.equal(PH_START_SPAWN.facing, Math.PI / 2);
  assert.equal(paleHollowWalkable(PH_START_SPAWN.x, PH_START_SPAWN.z), true);
});

test("a ring stays shut until the body walks into it, then it can be used", () => {
  const closed = tryUseWarp("warp-mayflower", []);
  assert.equal(closed.ok, false);
  assert.equal(tryUseWarp("warp-nope", []).ok, false);

  const missed = reachWarp([], PH_START_SPAWN.x, PH_START_SPAWN.z);
  assert.equal(missed.added, null);

  const opened = reachWarp([], 174, 191.5);
  assert.equal(opened.added, "warp-mayflower");
  const again = reachWarp(opened.unlocked, 174, 191.5);
  assert.equal(again.added, null);
  assert.deepEqual(again.unlocked, ["warp-mayflower"]);

  const used = tryUseWarp("warp-mayflower", opened.unlocked);
  assert.equal(used.ok, true);
  if (!used.ok) return;
  assert.equal(used.x, 174);
  assert.equal(used.z, 191.5);
});

test("Mayflower respawn waits on the ring; Emberwatch does not; old saves stay at the Scout Gate", () => {
  const ember = respawnStand("emberwatch", []);
  assert.equal(ember.x, -53);
  assert.equal(ember.z, 297);

  const denied = respawnStand("mayflower", []);
  assert.equal(denied.home, "hub");
  assert.equal(denied.x, PH_HUB_SPAWN.x);

  const bound = respawnStand("mayflower", ["warp-mayflower"]);
  assert.equal(bound.home, "mayflower");
  assert.equal(bound.x, 174);
  assert.equal(bound.z, 191.5);

  assert.equal(trySetRespawn("mayflower", [], 174, 191.5).ok, false);
  assert.equal(trySetRespawn("mayflower", ["warp-mayflower"], PH_START_SPAWN.x, PH_START_SPAWN.z).ok, false);
  const set = trySetRespawn("mayflower", ["warp-mayflower"], 174, 191.5);
  assert.deepEqual(set, { ok: true, home: "mayflower" });
  assert.deepEqual(trySetRespawn("emberwatch", [], 0, 0), { ok: true, home: "emberwatch" });
});

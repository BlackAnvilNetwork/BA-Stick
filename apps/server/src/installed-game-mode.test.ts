import assert from "node:assert/strict";
import test from "node:test";
import { installedGameMode } from "./installed-game-mode";

test("an installed game defaults to validator and replica is opt-in", () => {
  const untouched = installedGameMode();
  assert.deepEqual(untouched, { mode: "validator" });

  const checksPassButFlagOff = installedGameMode({
    replicaFlag: false,
    canHoldReplica: true,
    reachable: true,
  });
  assert.deepEqual(checksPassButFlagOff, { mode: "validator" });

  const refused = installedGameMode({
    replicaFlag: true,
    canHoldReplica: false,
    reachable: true,
  });
  assert.deepEqual(refused, { mode: "validator" });

  const unreachable = installedGameMode({
    replicaFlag: true,
    canHoldReplica: true,
    reachable: false,
  });
  assert.deepEqual(unreachable, { mode: "validator" });

  const replica = installedGameMode({
    replicaFlag: true,
    canHoldReplica: true,
    reachable: true,
  });
  assert.deepEqual(replica, { mode: "replica" });
  assert.equal("combatBonus" in replica, false);
  assert.equal("secondGuild" in replica, false);
  assert.equal("listingKey" in replica, false);
});

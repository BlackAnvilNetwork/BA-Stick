import assert from "node:assert/strict";
import test from "node:test";
import {
  installedGameMode,
  readResourceSnapshot,
  replicaMayTick,
  type ResourceSnapshot,
} from "./installed-game-mode";

const finiteResources = (): ResourceSnapshot => readResourceSnapshot();

test("a fresh process is a validator and does not tick or lead", async () => {
  const mode = await installedGameMode({});
  assert.deepEqual(mode, { mode: "validator", ticksWorld: false, leads: false });
  assert.equal(replicaMayTick(mode), false);
});

test("replica stays off until the operator opts in, even when both checks would pass", async () => {
  const mode = await installedGameMode(
    { LOK_REPLICA: "0" },
    {
      readResources: finiteResources,
      probeReachability: async () => true,
    },
  );
  assert.equal(mode.mode, "validator");
  assert.equal(mode.ticksWorld, false);
  assert.equal(mode.leads, false);
  assert.equal(replicaMayTick(mode), false);
});

test("a failing resource self-check keeps the opted-in process a validator", async () => {
  const thrown = await installedGameMode(
    { LOK_REPLICA: "1" },
    {
      readResources: () => {
        throw new Error("os read failed");
      },
      probeReachability: async () => true,
    },
  );
  assert.equal(thrown.mode, "validator");
  assert.equal(replicaMayTick(thrown), false);

  const notFinite = await installedGameMode(
    { LOK_REPLICA: "1" },
    {
      readResources: () => ({
        logicalCpus: Number.NaN,
        freeMemoryBytes: Number.NaN,
        freeDiskBytes: Number.NaN,
      }),
      probeReachability: async () => true,
    },
  );
  assert.equal(notFinite.mode, "validator");
  assert.equal(notFinite.ticksWorld, false);
  assert.equal(notFinite.leads, false);
});

test("a failing reachability check keeps the opted-in process a validator", async () => {
  const mode = await installedGameMode(
    { LOK_REPLICA: "1" },
    {
      readResources: finiteResources,
      probeReachability: async () => false,
    },
  );
  assert.equal(mode.mode, "validator");
  assert.equal(mode.ticksWorld, false);
  assert.equal(mode.leads, false);
  assert.equal(replicaMayTick(mode), false);
});

test("opt-in replica may tick and lead only after both process checks pass", async () => {
  const mode = await installedGameMode(
    { LOK_REPLICA: "1" },
    {
      readResources: finiteResources,
      probeReachability: async () => true,
    },
  );
  assert.deepEqual(mode, { mode: "replica", ticksWorld: true, leads: true });
  assert.equal(replicaMayTick(mode), true);
  assert.deepEqual(Object.keys(mode).sort(), ["leads", "mode", "ticksWorld"]);
  assert.equal("combatBonus" in mode, false);
  assert.equal("secondGuild" in mode, false);
  assert.equal("listingKey" in mode, false);
});

test("the process runs the OS resource read and the loopback reachability check", async () => {
  const seen = readResourceSnapshot();
  assert.equal(Number.isFinite(seen.logicalCpus), true);
  assert.equal(Number.isFinite(seen.freeMemoryBytes), true);
  assert.equal(Number.isFinite(seen.freeDiskBytes), true);

  const mode = await installedGameMode({ LOK_REPLICA: "1" });
  assert.equal(mode.mode, "replica");
  assert.equal(replicaMayTick(mode), true);
});

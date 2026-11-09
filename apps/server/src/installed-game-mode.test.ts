import assert from "node:assert/strict";
import test from "node:test";
import { installedGameMode, readResourceSnapshot, type ResourceSnapshot } from "./installed-game-mode";

const finiteResources = (): ResourceSnapshot => readResourceSnapshot();

test("a fresh process is an observer", async () => {
  const mode = await installedGameMode({});
  assert.deepEqual(mode, { role: "observer" });
});

test("replica stays off until the operator opts in, even when both checks would pass", async () => {
  const mode = await installedGameMode(
    { LOK_REPLICA: "0" },
    {
      readResources: finiteResources,
      probeReachability: async () => true,
    },
  );
  assert.equal(mode.role, "observer");
});

test("a failing resource self-check keeps the opted-in process an observer", async () => {
  const thrown = await installedGameMode(
    { LOK_REPLICA: "1" },
    {
      readResources: () => {
        throw new Error("os read failed");
      },
      probeReachability: async () => true,
    },
  );
  assert.equal(thrown.role, "observer");

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
  assert.equal(notFinite.role, "observer");
});

test("a failing reachability check keeps the opted-in process an observer", async () => {
  const mode = await installedGameMode(
    { LOK_REPLICA: "1" },
    {
      readResources: finiteResources,
      probeReachability: async () => false,
    },
  );
  assert.equal(mode.role, "observer");
});

test("opt-in replica is leader-eligible only after both process checks pass", async () => {
  const mode = await installedGameMode(
    { LOK_REPLICA: "1" },
    {
      readResources: finiteResources,
      probeReachability: async () => true,
    },
  );
  assert.deepEqual(mode, { role: "replica" });
  assert.deepEqual(Object.keys(mode).sort(), ["role"]);
  assert.equal("combatBonus" in mode, false);
  assert.equal("secondGuild" in mode, false);
  assert.equal("listingKey" in mode, false);
  assert.equal("ticksWorld" in mode, false);
  assert.equal("leads" in mode, false);
});

test("the process runs the OS resource read and the loopback reachability check", async () => {
  const seen = readResourceSnapshot();
  assert.equal(Number.isFinite(seen.logicalCpus), true);
  assert.equal(Number.isFinite(seen.freeMemoryBytes), true);
  assert.equal(Number.isFinite(seen.freeDiskBytes), true);

  const mode = await installedGameMode({ LOK_REPLICA: "1" });
  assert.equal(mode.role, "replica");
});

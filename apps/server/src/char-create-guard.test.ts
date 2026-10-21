import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { JOB_IDS } from "@bellgrave/combat";
import { refuseZeroMintFee, resolveBindSpawnJob } from "./char-create-guard";

describe("resolveBindSpawnJob", () => {
  it("spawns the on-chain genesis job and ignores a mismatched client job", () => {
    const clientJob = JOB_IDS.indexOf("time_mage");
    const genesisJob = JOB_IDS.indexOf("knight");
    assert.notEqual(clientJob, genesisJob);
    const resolved = resolveBindSpawnJob({ genesisJob });
    assert.equal(resolved.ok, true);
    if (!resolved.ok) return;
    assert.equal(resolved.jobIndex, genesisJob);
    assert.equal(resolved.job, "knight");
    assert.notEqual(resolved.jobIndex, clientJob);
  });

  it("refuses a token with no genesis record", () => {
    const resolved = resolveBindSpawnJob({
      genesisJob: null,
      genesisError: "Character #7 has no on-chain genesis.",
    });
    assert.equal(resolved.ok, false);
    if (resolved.ok) return;
    assert.match(resolved.error, /no on-chain genesis/);
  });

  it("refuses a genesis job outside the playable set", () => {
    const resolved = resolveBindSpawnJob({ genesisJob: 99 });
    assert.equal(resolved.ok, false);
    if (resolved.ok) return;
    assert.match(resolved.error, /not a playable job/);
  });
});

describe("refuseZeroMintFee", () => {
  it("blocks a zero fee on Gnosis and Chiado", () => {
    for (const chainId of [100, 10200]) {
      const refused = refuseZeroMintFee(chainId, "0");
      assert.equal(refused.ok, false);
      if (refused.ok) continue;
      assert.match(refused.error, /mint fee is 0/);
    }
  });

  it("allows a positive fee on production and a zero fee on anvil", () => {
    assert.equal(refuseZeroMintFee(100, "1000000000000000").ok, true);
    assert.equal(refuseZeroMintFee(31337, "0").ok, true);
  });
});

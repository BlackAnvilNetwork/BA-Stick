/**
 * Support review of 9692ea2: dev faucet gates + concurrent reserve (L1).
 * Race case self-starts a throwaway anvil when foundry is available.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { devFaucetEnabled, faucetAnvilEth, resetFaucetRateLimitsForTests } from "./lok-vault";
import { resolveAnvilBin, startThrowawayAnvil, type ThrowawayAnvil } from "./support-anvil";

const ENV_RPC = process.env.LOK_SUPPORT_RPC ?? "";
const K0 = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const canRace = !!(ENV_RPC || resolveAnvilBin());

describe("support 9692ea2: dev faucet", () => {
  it("is off for non-31337 chain ids even with an owner key + RPC", () => {
    assert.equal(
      devFaucetEnabled({
        LOK_OWNER_KEY: K0,
        LOK_CHAIN_RPC: "https://mainnet.example",
        LOK_CHAIN_ID: "1",
      } as NodeJS.ProcessEnv),
      false,
    );
    assert.equal(
      devFaucetEnabled({
        LOK_OWNER_KEY: K0,
        LOK_CHAIN_RPC: "http://127.0.0.1:8545",
        LOK_CHAIN_ID: "31337",
      } as NodeJS.ProcessEnv),
      true,
    );
    assert.equal(
      devFaucetEnabled({
        LOK_OWNER_KEY: K0,
        LOK_CHAIN_RPC: "http://127.0.0.1:8545",
        LOK_CHAIN_ID: "31337",
        LOK_DEV_FAUCET: "0",
      } as NodeJS.ProcessEnv),
      false,
    );
  });

  it("refuses to send to a wallet other than the caller", async () => {
    const r = await faucetAnvilEth(
      "0x00000000000000000000000000000000000000b1",
      {
        LOK_OWNER_KEY: K0,
        LOK_CHAIN_RPC: ENV_RPC || "http://127.0.0.1:1",
        LOK_CHAIN_ID: "31337",
      } as NodeJS.ProcessEnv,
      { callerWallet: "0x00000000000000000000000000000000000000b2" },
    );
    assert.equal(r.ok, false);
  });

  describe("concurrent payouts", { skip: !canRace }, () => {
    let owned: ThrowawayAnvil | undefined;
    let rpc = ENV_RPC;

    before(async () => {
      if (rpc) return;
      owned = await startThrowawayAnvil();
      rpc = owned.rpc;
    });

    after(() => {
      owned?.stop();
    });

    it("concurrent requests from one wallet pay out only once per cooldown", async () => {
      resetFaucetRateLimitsForTests();
      const to = "0x" + Date.now().toString(16).padStart(40, "0");
      const env = {
        LOK_OWNER_KEY: K0,
        LOK_CHAIN_RPC: rpc,
        LOK_CHAIN_ID: "31337",
      } as NodeJS.ProcessEnv;
      const results = await Promise.all(
        Array.from({ length: 5 }, () => faucetAnvilEth(to, env, { callerWallet: to })),
      );
      const paid = results.filter((r) => r.ok).length;
      assert.equal(paid, 1, paid + " payouts of 0.1 ETH inside one cooldown window");
    });
  });
});

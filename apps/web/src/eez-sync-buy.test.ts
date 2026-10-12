import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import type { Account, WalletClient } from "viem";
import { buyAsksWithEezSync } from "./eez-sync-buy";
import type { WalletSession } from "./wallet";

function fakeSession(source: WalletSession["source"]): WalletSession {
  const address = "0x1111111111111111111111111111111111111111" as `0x${string}`;
  return {
    address,
    account: address as unknown as Account,
    source,
    client: {
      writeContract: async () => {
        throw new Error("stop-after-session");
      },
    } as unknown as WalletClient,
  };
}

const eezCfg = {
  syncBuyEnabled: true,
  zoneId: "mock",
  homeChainId: 100,
  homeRpcUrl: "http://127.0.0.1:8545",
  homeLabel: "Gnosis",
  mockSyncBuy: "0x3333333333333333333333333333333333333333",
  gameEscrow: null,
  gameChainId: 100,
};

describe("buyAsksWithEezSync wallet routing", () => {
  it("never requests burner when AppKit is available (no injected)", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const getSession = mock.fn(async (opts: Record<string, unknown>) => {
      calls.push(opts);
      return fakeSession("appkit");
    });

    const res = await buyAsksWithEezSync({
      eez: eezCfg,
      buyerTokenId: "1",
      fills: [{ listingId: "1", priceWei: "1000000000000000000" }],
      getSession: getSession as unknown as typeof import("./wallet").getWalletSession,
      forceWalletFlags: { hasInjected: false, appKitConfigured: true, burnerAllowed: false },
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.preferWalletConnect, true);
    assert.equal(calls[0]!.allowBurnerFallback, false);
    assert.equal(res.ok, false);
    assert.match(res.error, /stop-after-session/);
  });

  it("refuses a burner session even if getSession misbehaves while AppKit is configured", async () => {
    const res = await buyAsksWithEezSync({
      eez: eezCfg,
      buyerTokenId: "1",
      fills: [{ listingId: "1", priceWei: "1" }],
      getSession: async () => fakeSession("burner"),
      forceWalletFlags: { hasInjected: false, appKitConfigured: true, burnerAllowed: false },
    });
    assert.equal(res.ok, false);
    assert.match(res.error, /burner/i);
    assert.equal(res.hashes.length, 0);
  });

  it("refuses burner on non-anvil even when AppKit is not configured", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const getSession = mock.fn(async (opts: Record<string, unknown>) => {
      calls.push(opts);
      return fakeSession("burner");
    });

    const res = await buyAsksWithEezSync({
      eez: eezCfg,
      buyerTokenId: "1",
      fills: [{ listingId: "1", priceWei: "1" }],
      getSession: getSession as unknown as typeof import("./wallet").getWalletSession,
      forceWalletFlags: { hasInjected: false, appKitConfigured: false, burnerAllowed: false },
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.allowBurnerFallback, false);
    assert.equal(res.ok, false);
    assert.match(res.error, /burner/i);
    assert.equal(res.hashes.length, 0);
  });

  it("errors clearly when no wallet session can be obtained", async () => {
    const res = await buyAsksWithEezSync({
      eez: eezCfg,
      buyerTokenId: "1",
      fills: [{ listingId: "1", priceWei: "1" }],
      getSession: async () => {
        throw new Error("Connect an injected wallet or Reown AppKit to pay.");
      },
      forceWalletFlags: { hasInjected: false, appKitConfigured: true, burnerAllowed: false },
    });
    assert.equal(res.ok, false);
    assert.match(res.error, /AppKit|wallet/i);
    assert.equal(res.hashes.length, 0);
  });
});

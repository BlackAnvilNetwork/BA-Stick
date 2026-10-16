import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import type { Account, WalletClient } from "viem";
import { buyAsksWithWallet, type EscrowFillAdmission } from "./ah-buy";
import type { WalletSession } from "./wallet";

const admitOpen = async (): Promise<EscrowFillAdmission> => ({ ok: true, epoch: 0 });

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

describe("buyAsksWithWallet wallet routing", () => {
  it("never requests burner when AppKit is available (no injected)", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const getSession = mock.fn(async (opts: Record<string, unknown>) => {
      calls.push(opts);
      return fakeSession("appkit");
    });

    const res = await buyAsksWithWallet({
      escrow: {
        address: "0x2222222222222222222222222222222222222222",
        chainId: 100,
        rpcUrl: "http://127.0.0.1:8545",
      },
      buyerTokenId: "1",
      fills: [{ listingId: "1", priceWei: "1000000000000000000" }],
      admitFill: admitOpen,
      getSession: getSession as unknown as typeof import("./wallet").getWalletSession,
      forceWalletFlags: { hasInjected: false, appKitConfigured: true, burnerAllowed: false },
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.preferWalletConnect, true);
    assert.equal(calls[0]!.allowBurnerFallback, false);
    assert.equal(res.ok, false);
    assert.match(res.error, /stop-after-session|Buy failed/);
  });

  it("refuses a burner session even if getSession misbehaves while AppKit is configured", async () => {
    const res = await buyAsksWithWallet({
      escrow: {
        address: "0x2222222222222222222222222222222222222222",
        chainId: 100,
        rpcUrl: "http://127.0.0.1:8545",
      },
      buyerTokenId: "1",
      fills: [{ listingId: "1", priceWei: "1" }],
      admitFill: admitOpen,
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

    const res = await buyAsksWithWallet({
      escrow: {
        address: "0x2222222222222222222222222222222222222222",
        chainId: 100,
        rpcUrl: "http://127.0.0.1:8545",
      },
      buyerTokenId: "1",
      fills: [{ listingId: "1", priceWei: "1" }],
      admitFill: admitOpen,
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
    const res = await buyAsksWithWallet({
      escrow: {
        address: "0x2222222222222222222222222222222222222222",
        chainId: 100,
        rpcUrl: "http://127.0.0.1:8545",
      },
      buyerTokenId: "1",
      fills: [{ listingId: "1", priceWei: "1" }],
      admitFill: admitOpen,
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

describe("buyAsk epoch cap", { concurrency: false }, () => {
  it("does not broadcast buyAsk when no bond is posted or the epoch would pass 10%", async () => {
    const {
      EPOCH_XDAI_CAP_REFUSAL,
      admitEscrowFill,
      chainBoundXdaiSend,
      epochSettledXdai,
      resetRootAnchorForTests,
    } = await import("../../server/src/root-anchor.ts");
    const { allowEpochSettlementForTests } = await import("../../server/src/epoch-cap-fixture.ts");
    const escrow = {
      address: "0x2222222222222222222222222222222222222222",
      chainId: 31337,
      rpcUrl: "http://127.0.0.1:8545",
    };
    let writes = 0;
    const session = fakeSession("injected");
    session.client.writeContract = (async () => {
      writes += 1;
      throw new Error("should-not-broadcast");
    }) as typeof session.client.writeContract;
    const admitFill = (priceWei: string) => Promise.resolve(admitEscrowFill(BigInt(priceWei)));
    try {
      await allowEpochSettlementForTests(0n);
      const zero = await buyAsksWithWallet({
        escrow,
        buyerTokenId: "1",
        fills: [{ listingId: "1", priceWei: "1000000000000000000" }],
        admitFill,
        getSession: async () => session,
        forceWalletFlags: { hasInjected: true, appKitConfigured: false, burnerAllowed: true },
      });
      assert.equal(zero.ok, false);
      if (!zero.ok) assert.equal(zero.error, EPOCH_XDAI_CAP_REFUSAL);
      assert.equal(writes, 0);
      assert.equal(epochSettledXdai(), 0n);

      await allowEpochSettlementForTests(100n);
      assert.equal(chainBoundXdaiSend("withdrawal", 10n).ok, true);
      const past = await buyAsksWithWallet({
        escrow,
        buyerTokenId: "1",
        fills: [{ listingId: "1", priceWei: "1" }],
        admitFill,
        getSession: async () => session,
        forceWalletFlags: { hasInjected: true, appKitConfigured: false, burnerAllowed: true },
      });
      assert.equal(past.ok, false);
      if (!past.ok) assert.equal(past.error, EPOCH_XDAI_CAP_REFUSAL);
      assert.equal(writes, 0);
      assert.equal(epochSettledXdai(), 10n);
    } finally {
      resetRootAnchorForTests();
    }
  });
});

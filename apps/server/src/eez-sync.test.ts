/**
 * EEZ sync-buy local wiring (zone registration + plan + client config).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { eezClientConfig, eezLocalGateOk, eezZoneConfig, planEezSyncBuy } from "./eez-sync";

const ESCROW = "0x00000000000000000000000000000000000000e1";
const MOCK = "0x00000000000000000000000000000000000000e2";

describe("eez sync buy (local mock)", () => {
  it("stays disabled without opt-in", () => {
    const z = eezZoneConfig({} as NodeJS.ProcessEnv);
    assert.equal(z.syncBuyEnabled, false);
    const plan = planEezSyncBuy(
      { listingId: "1", priceWei: "1", buyerTokenId: "2", homeChainId: 31337 },
      {} as NodeJS.ProcessEnv,
    );
    assert.equal(plan.ok, false);
  });

  it("M-D: stays disabled on mainnet / non-local RPC even with mock env set", () => {
    const env = {
      LOK_EEZ_SYNC_BUY: "1",
      LOK_EEZ_ZONE_ID: "local-31337",
      LOK_EEZ_MOCK_SYNC_BUY: MOCK,
      LOK_AH_ESCROW: ESCROW,
      LOK_CHAIN_RPC: "https://mainnet.example",
      LOK_CHAIN_ID: "1",
    } as NodeJS.ProcessEnv;
    assert.equal(eezLocalGateOk(env), false);
    assert.equal(eezZoneConfig(env).syncBuyEnabled, false);
    const client = eezClientConfig(env);
    assert.ok(!client || client.syncBuyEnabled === false);
  });

  it("enables with zone + mock + AhEscrow on local 31337 and plans a local-mock call", () => {
    const env = {
      LOK_EEZ_SYNC_BUY: "1",
      LOK_EEZ_ZONE_ID: "local-31337",
      LOK_EEZ_MOCK_SYNC_BUY: MOCK,
      LOK_AH_ESCROW: ESCROW,
      LOK_CHAIN_RPC: "http://127.0.0.1:8545",
      LOK_CHAIN_ID: "31337",
    } as NodeJS.ProcessEnv;
    const z = eezZoneConfig(env);
    assert.equal(z.syncBuyEnabled, true);
    assert.equal(z.mockSyncBuy, MOCK.toLowerCase());
    assert.equal(z.homeChainId, 31337);
    const client = eezClientConfig(env);
    assert.ok(client);
    assert.equal(client!.syncBuyEnabled, true);
    assert.equal(client!.mockSyncBuy, MOCK.toLowerCase());
    const plan = planEezSyncBuy(
      {
        listingId: "7",
        priceWei: "20000000000000000",
        buyerTokenId: "3",
        homeChainId: 31337,
      },
      env,
    );
    assert.equal(plan.ok, true);
    if (plan.ok) {
      assert.equal(plan.mode, "local-mock");
      assert.equal(plan.mockAddress, MOCK.toLowerCase());
      assert.equal(plan.sellerPayoutSameBatch, true);
      assert.equal(plan.gameEscrow, ESCROW);
    }
  });

  it("rejects a home chain that is not configured", () => {
    const env = {
      LOK_EEZ_SYNC_BUY: "1",
      LOK_EEZ_ZONE_ID: "local-31337",
      LOK_EEZ_MOCK_SYNC_BUY: MOCK,
      LOK_AH_ESCROW: ESCROW,
      LOK_CHAIN_RPC: "http://127.0.0.1:8545",
      LOK_CHAIN_ID: "31337",
    } as NodeJS.ProcessEnv;
    const plan = planEezSyncBuy(
      { listingId: "7", priceWei: "1", buyerTokenId: "3", homeChainId: 1 },
      env,
    );
    assert.equal(plan.ok, false);
  });
});

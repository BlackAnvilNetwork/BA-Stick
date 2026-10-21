import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cachedSettlementChainId,
  envSettlementChainId,
  setCachedSettlementChainId,
  settlementChainId,
  settlementUnitSymbol,
} from "./settlement-chain";

describe("settlement-chain", () => {
  it("falls back to LOK_CHAIN_ID when RPC cache is empty", () => {
    setCachedSettlementChainId(null);
    assert.equal(envSettlementChainId({ LOK_CHAIN_ID: "10200" }), 10200);
    assert.equal(settlementChainId({ LOK_CHAIN_ID: "10200" }), 10200);
    assert.equal(settlementUnitSymbol({ LOK_CHAIN_ID: "10200" }), "xDAI");
  });

  it("prefers RPC cache over LOK_CHAIN_ID for labels", () => {
    setCachedSettlementChainId(100);
    assert.equal(settlementChainId({ LOK_CHAIN_ID: "31337" }), 100);
    assert.equal(settlementUnitSymbol({ LOK_CHAIN_ID: "31337" }), "xDAI");
    setCachedSettlementChainId(null);
  });

  it("cache expires after TTL and falls back to LOK_CHAIN_ID", async () => {
    // Set cache with very short TTL (1ms)
    setCachedSettlementChainId(100, 1);
    // Wait for cache to expire
    await new Promise((resolve) => setTimeout(resolve, 5));
    // Cache should be considered expired
    assert.equal(cachedSettlementChainId(), null);
    assert.equal(settlementChainId({ LOK_CHAIN_ID: "31337" }), 31337);

    // Set cache with valid TTL
    setCachedSettlementChainId(100, 60_000);
    assert.equal(cachedSettlementChainId(), 100);
    assert.equal(settlementChainId({ LOK_CHAIN_ID: "31337" }), 100);

    // Clear for other tests
    setCachedSettlementChainId(null);
  });
});

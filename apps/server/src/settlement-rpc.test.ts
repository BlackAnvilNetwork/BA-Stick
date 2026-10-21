import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  RotatingJsonRpc,
  resetSettlementRpcForTests,
  settlementRpc,
  watcherLagBlocks,
  watcherStartBlock,
} from "./settlement-rpc";

describe("settlement-rpc", () => {
  it("watcherStartBlock reads LOK_DEPLOY_BLOCK", () => {
    assert.equal(watcherStartBlock({}), 0n);
    assert.equal(watcherStartBlock({ LOK_DEPLOY_BLOCK: "12345" }), 12345n);
  });

  it("watcherLagBlocks is tip - confirmations - cursor", () => {
    assert.equal(
      watcherLagBlocks({ tip: 100n, cursor: 90n, confirmations: 2n }),
      8n,
    );
    assert.equal(
      watcherLagBlocks({ tip: 100n, cursor: 98n, confirmations: 2n }),
      0n,
    );
    assert.equal(watcherLagBlocks({ tip: null, cursor: 0n, confirmations: 2n }), 0n);
  });

  it("RotatingJsonRpc retries and rotates on failure", async () => {
    let hits = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      hits += 1;
      const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
      if (hits === 1) {
        return new Response(JSON.stringify({ error: { message: "429 rate limit" } }), {
          status: 200,
        });
      }
      return new Response(
        JSON.stringify({ result: body.method === "eth_blockNumber" ? "0x64" : "0x1" }),
        { status: 200 },
      );
    }) as typeof fetch;
    try {
      const rpc = new RotatingJsonRpc(["http://a.example", "http://b.example"], {
        minIntervalMs: 0,
        maxRetries: 3,
      });
      const tip = await rpc.call("eth_blockNumber", []);
      assert.equal(tip, "0x64");
      assert.ok(hits >= 2);
      assert.ok(rpc.stats.rotations >= 1);
      assert.equal(rpc.stats.tipBlock, 100n);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("settlementRpc builds from NETWORK profile URLs", () => {
    resetSettlementRpcForTests();
    const rpc = settlementRpc({
      NETWORK: "gnosis",
      LOK_CHAIN_RPC: "https://rpc.gnosischain.com",
      LOK_CHAIN_RPC_URLS:
        "https://rpc.gnosischain.com,https://gnosis-rpc.publicnode.com",
    });
    assert.ok(rpc.urls.length >= 2);
    assert.equal(rpc.currentUrl(), "https://rpc.gnosischain.com");
    resetSettlementRpcForTests();
  });
});

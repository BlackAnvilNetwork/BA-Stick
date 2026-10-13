import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyNetworkProfileEnv,
  explorerAddressUrl,
  explorerTxUrl,
  networkProfile,
  resolveNetworkName,
  settlementRpcUrls,
} from "./network-profile";

describe("network profiles", () => {
  it("resolves NETWORK=gnosis to chain 100 + xDAI", () => {
    assert.equal(resolveNetworkName({ NETWORK: "gnosis" }), "gnosis");
    const p = networkProfile("gnosis");
    assert.equal(p.chainId, 100);
    assert.equal(p.currency.symbol, "xDAI");
    assert.ok(p.rpcUrls.length >= 2);
    assert.equal(p.explorer, "https://gnosisscan.io");
  });

  it("maps LOK_CHAIN_ID / VITE_CHAIN_ID when NETWORK unset", () => {
    assert.equal(resolveNetworkName({ LOK_CHAIN_ID: "10200" }), "chiado");
    assert.equal(resolveNetworkName({ VITE_CHAIN_ID: "31337" }), "anvil");
    assert.equal(resolveNetworkName({}), "anvil");
  });

  it("applyNetworkProfileEnv fills blanks only", () => {
    const env: Record<string, string | undefined> = { NETWORK: "gnosis" };
    applyNetworkProfileEnv(env);
    assert.equal(env.LOK_CHAIN_ID, "100");
    assert.equal(env.LOK_CONFIRMATIONS, "30");
    assert.ok(env.LOK_CHAIN_RPC?.includes("gnosis"));
    assert.ok(env.LOK_CHAIN_RPC_URLS?.includes(","));
    assert.equal(env.LOK_EXPLORER, "https://gnosisscan.io");

    const kept: Record<string, string | undefined> = {
      NETWORK: "gnosis",
      LOK_CHAIN_ID: "100",
      LOK_CHAIN_RPC: "https://custom.example/rpc",
      LOK_CONFIRMATIONS: "8",
    };
    applyNetworkProfileEnv(kept);
    assert.equal(kept.LOK_CHAIN_RPC, "https://custom.example/rpc");
    assert.equal(kept.LOK_CONFIRMATIONS, "8");
  });

  it("settlementRpcUrls prefers LOK_CHAIN_RPC_URLS", () => {
    assert.deepEqual(
      settlementRpcUrls({
        LOK_CHAIN_RPC_URLS: "https://a.example, https://b.example",
        LOK_CHAIN_RPC: "https://ignored.example",
      }),
      ["https://a.example", "https://b.example"],
    );
  });

  it("builds explorer URLs", () => {
    assert.equal(
      explorerAddressUrl(100, "0x1111111111111111111111111111111111111111"),
      "https://gnosisscan.io/address/0x1111111111111111111111111111111111111111",
    );
    assert.equal(
      explorerTxUrl(
        100,
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      ),
      "https://gnosisscan.io/tx/0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );
    assert.equal(explorerAddressUrl(31337, "0x1111111111111111111111111111111111111111"), "");
  });
});

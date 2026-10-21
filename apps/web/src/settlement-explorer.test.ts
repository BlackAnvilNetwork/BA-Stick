import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  explorerAddressUrl,
  explorerTxUrl,
  networkProfile,
  settlementCurrency,
} from "@bellgrave/config";
import { settlementExampleAsk, settlementSymbol } from "@bellgrave/client-core/settlement-label";

describe("Gnosis web settlement + explorer", () => {
  it("VITE_NETWORK=gnosis profile is chain 100 with xDAI and gnosisscan", () => {
    const p = networkProfile({ VITE_NETWORK: "gnosis" });
    assert.equal(p.chainId, 100);
    assert.equal(p.currency.symbol, "xDAI");
    assert.equal(p.explorer, "https://gnosisscan.io");
    assert.equal(settlementCurrency(100).exampleAskHuman, "1");
  });

  it("labels character mint / AH asks as xDAI on chain 100", () => {
    assert.equal(settlementSymbol(undefined, 100), "xDAI");
    assert.equal(settlementExampleAsk(undefined, 100), "1");
    assert.equal(
      settlementSymbol(
        {
          chainId: 100,
          symbol: "xDAI",
          name: "xDAI",
          decimals: 18,
          defaultMintFeeWei: "1000000000000000000",
          exampleAskHuman: "1",
        },
        100,
      ),
      "xDAI",
    );
  });

  it("builds gnosisscan links for mint/buy hashes", () => {
    const hash = ("0x" + "ab".repeat(32)) as `0x${string}`;
    const addr = "0x1111111111111111111111111111111111111111";
    assert.equal(explorerTxUrl(100, hash), "https://gnosisscan.io/tx/" + hash);
    assert.equal(explorerAddressUrl(100, addr), "https://gnosisscan.io/address/" + addr);
    assert.equal(explorerTxUrl(31337, hash), "");
  });

  it("keeps chiado and anvil profiles for non-mainnet work", () => {
    assert.equal(networkProfile({ VITE_NETWORK: "chiado" }).chainId, 10200);
    assert.equal(networkProfile({ VITE_NETWORK: "anvil" }).chainId, 31337);
    assert.equal(settlementSymbol(undefined, 31337), "ETH");
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isSettlementChain,
  settlementCurrency,
  settlementCurrencyView,
} from "@bellgrave/config";

describe("settlement currency", () => {
  it("labels Gnosis / Chiado as xDAI with 1 xDAI default mint fee", () => {
    for (const id of [100, 10200]) {
      assert.equal(isSettlementChain(id), true);
      const c = settlementCurrency(id);
      assert.equal(c.symbol, "xDAI");
      assert.equal(c.decimals, 18);
      assert.equal(c.defaultMintFeeWei, 10n ** 18n);
      assert.equal(c.exampleAskHuman, "1");
      assert.equal(settlementCurrencyView(id).defaultMintFeeWei, "1000000000000000000");
    }
  });

  it("labels anvil as ETH with 0.001 default mint fee", () => {
    const c = settlementCurrency(31337);
    assert.equal(c.symbol, "ETH");
    assert.equal(c.defaultMintFeeWei, 10n ** 15n);
  });
});

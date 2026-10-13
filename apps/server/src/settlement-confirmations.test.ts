import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";
import {
  DEFAULT_GNOSIS_CONFIRMATIONS,
  DEFAULT_LOCAL_CONFIRMATIONS,
  settlementConfirmations,
} from "./settlement-confirmations";
import { setCachedSettlementChainId } from "./settlement-chain";

describe("settlementConfirmations", () => {
  afterEach(() => setCachedSettlementChainId(null));

  it("defaults to local depth on 31337", () => {
    assert.equal(settlementConfirmations({ LOK_CHAIN_ID: "31337" }), DEFAULT_LOCAL_CONFIRMATIONS);
  });

  it("defaults to gnosis depth on 100/10200", () => {
    assert.equal(settlementConfirmations({ LOK_CHAIN_ID: "100" }), DEFAULT_GNOSIS_CONFIRMATIONS);
    assert.equal(settlementConfirmations({ LOK_CHAIN_ID: "10200" }), DEFAULT_GNOSIS_CONFIRMATIONS);
  });

  it("honors LOK_CONFIRMATIONS override", () => {
    assert.equal(settlementConfirmations({ LOK_CHAIN_ID: "100", LOK_CONFIRMATIONS: "8" }), 8n);
  });
});

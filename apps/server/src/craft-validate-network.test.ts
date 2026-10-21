import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { craftValidateMinSeqForNetwork } from "./lok-world";

describe("craftValidateMinSeqForNetwork", () => {
  it("legacy anvil keeps seq 175; Chiado and Gnosis are fresh (0)", () => {
    assert.equal(craftValidateMinSeqForNetwork({ NETWORK: "anvil" }), 175);
    assert.equal(craftValidateMinSeqForNetwork({ LOK_CHAIN_ID: "31337" }), 175);
    assert.equal(craftValidateMinSeqForNetwork({ NETWORK: "chiado" }), 0);
    assert.equal(craftValidateMinSeqForNetwork({ NETWORK: "gnosis" }), 0);
    assert.equal(craftValidateMinSeqForNetwork({ LOK_CHAIN_ID: "100" }), 0);
    assert.equal(craftValidateMinSeqForNetwork({ LOK_CHAIN_ID: "10200" }), 0);
  });

  it("LOK_CRAFT_VALIDATE_MIN_SEQ overrides the network default", () => {
    assert.equal(
      craftValidateMinSeqForNetwork({ NETWORK: "gnosis", LOK_CRAFT_VALIDATE_MIN_SEQ: "175" }),
      175,
    );
    assert.equal(
      craftValidateMinSeqForNetwork({ NETWORK: "anvil", LOK_CRAFT_VALIDATE_MIN_SEQ: "0" }),
      0,
    );
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isWalletDisconnectedError,
  WALLET_DISCONNECTED_HINT,
} from "./wallet-provider.ts";

describe("wallet provider disconnect", () => {
  it("recognizes Rainbow 4900 and wrapped causes", () => {
    assert.equal(isWalletDisconnectedError({ code: 4900, message: "The provider is disconnected from all chains." }), true);
    assert.equal(isWalletDisconnectedError(new Error("The provider is disconnected from all chains.")), true);
    assert.equal(
      isWalletDisconnectedError({ cause: { code: 4900, message: "The provider is disconnected from all chains." } }),
      true,
    );
    assert.equal(isWalletDisconnectedError({ code: 4001, message: "User rejected" }), false);
    assert.match(WALLET_DISCONNECTED_HINT, /Gnosis/);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertWalletConnectProjectIdForPublicNetwork,
  burnerIdentityAllowed,
  walletConnectRequiredForNetwork,
} from "./burner-identity";

describe("burnerIdentityAllowed", () => {
  it("allows burner on anvil only", () => {
    assert.equal(burnerIdentityAllowed({ VITE_NETWORK: "anvil" }), true);
    assert.equal(burnerIdentityAllowed({ VITE_CHAIN_ID: "31337" }), true);
    assert.equal(burnerIdentityAllowed({ VITE_NETWORK: "gnosis" }), false);
    assert.equal(burnerIdentityAllowed({ VITE_NETWORK: "chiado" }), false);
    assert.equal(burnerIdentityAllowed({ VITE_CHAIN_ID: "100" }), false);
    assert.equal(burnerIdentityAllowed({ VITE_CHAIN_ID: "10200" }), false);
  });

  it("requires WalletConnect project id on public settlement networks", () => {
    assert.equal(walletConnectRequiredForNetwork({ VITE_NETWORK: "gnosis" }), true);
    assert.equal(walletConnectRequiredForNetwork({ VITE_NETWORK: "chiado" }), true);
    assert.equal(walletConnectRequiredForNetwork({ VITE_NETWORK: "anvil" }), false);
  });

  it("throws when public network lacks a project id", () => {
    assert.throws(
      () =>
        assertWalletConnectProjectIdForPublicNetwork({
          VITE_NETWORK: "gnosis",
          VITE_WALLETCONNECT_PROJECT_ID: "",
        }),
      /VITE_WALLETCONNECT_PROJECT_ID/,
    );
    assert.doesNotThrow(() =>
      assertWalletConnectProjectIdForPublicNetwork({
        VITE_NETWORK: "anvil",
        VITE_WALLETCONNECT_PROJECT_ID: "",
      }),
    );
    assert.doesNotThrow(() =>
      assertWalletConnectProjectIdForPublicNetwork({
        VITE_NETWORK: "gnosis",
        VITE_WALLETCONNECT_PROJECT_ID: "12345678abcd",
      }),
    );
  });
});

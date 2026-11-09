import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertWalletConnectProjectIdForPublicNetwork,
  burnerIdentityAllowed,
  isStoredLocalBurnerWallet,
  LOCAL_BURNER_KEY_KEY,
  LOCAL_BURNER_WALLET_KEY,
  walletConnectRequiredForNetwork,
} from "./burner-identity";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

describe("burnerIdentityAllowed", () => {
  it("allows burner on anvil only", () => {
    assert.equal(burnerIdentityAllowed({}), false);
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

  it("flags the leftover local burner on Gnosis without reading the key", () => {
    const burner = "0xE979945A7830abc665d59AD330EfEC083f10d722";
    const store = {
      getItem: (key: string) => (key === LOCAL_BURNER_WALLET_KEY ? burner : null),
    };
    const gnosis = { VITE_NETWORK: "gnosis" };
    assert.equal(isStoredLocalBurnerWallet(burner, store, gnosis), true);
    assert.equal(isStoredLocalBurnerWallet(burner.toLowerCase(), store, gnosis), true);
    assert.equal(
      isStoredLocalBurnerWallet("0x0c8F70DF8a57b08C0F1A5F516B5277b8a1e9620b", store, gnosis),
      false,
    );
    assert.equal(isStoredLocalBurnerWallet(burner, store, { VITE_NETWORK: "anvil" }), false);
  });

  it("matches leftover burner from walletKey when the address slot was overwritten", () => {
    const key = generatePrivateKey();
    const burner = privateKeyToAccount(key).address;
    const store = {
      getItem: (k: string) => (k === LOCAL_BURNER_KEY_KEY ? key : null),
    };
    const gnosis = { VITE_NETWORK: "gnosis" };
    assert.equal(isStoredLocalBurnerWallet(burner, store, gnosis), true);
    assert.equal(
      isStoredLocalBurnerWallet("0x0c8F70DF8a57b08C0F1A5F516B5277b8a1e9620b", store, gnosis),
      false,
    );
  });
});

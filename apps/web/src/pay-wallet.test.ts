import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { payWalletSessionOpts } from "./pay-wallet";

describe("payWalletSessionOpts", () => {
  it("prefers AppKit and forbids burner when AppKit is configured without injected wallet", () => {
    const o = payWalletSessionOpts({ hasInjected: false, appKitConfigured: true });
    assert.equal(o.preferWalletConnect, true);
    assert.equal(o.allowBurnerFallback, false);
  });

  it("uses injected when present and does not force AppKit modal", () => {
    const o = payWalletSessionOpts({ hasInjected: true, appKitConfigured: true });
    assert.equal(o.preferWalletConnect, false);
    assert.equal(o.allowBurnerFallback, false);
  });

  it("allows burner only for local anvil-style setups without AppKit or injected", () => {
    const o = payWalletSessionOpts({ hasInjected: false, appKitConfigured: false });
    assert.equal(o.preferWalletConnect, false);
    assert.equal(o.allowBurnerFallback, true);
  });
});

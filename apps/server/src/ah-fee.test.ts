import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AH_FEE_BPS, AH_TREASURY_FEE_BPS, AH_VAULT_FEE_BPS, ahFeeSplit, ahGuildFeeShares } from "@bellgrave/protocol";

describe("ahFeeSplit (5% floor)", () => {
  it("matches AhEscrow rounding cases", () => {
    assert.equal(AH_FEE_BPS, 500);
    assert.deepEqual(ahFeeSplit(1n), { feeWei: 0n, sellerNetWei: 1n });
    assert.deepEqual(ahFeeSplit(19n), { feeWei: 0n, sellerNetWei: 19n });
    assert.deepEqual(ahFeeSplit(20n), { feeWei: 1n, sellerNetWei: 19n });
    assert.deepEqual(ahFeeSplit(21n), { feeWei: 1n, sellerNetWei: 20n });
    assert.deepEqual(ahFeeSplit(39n), { feeWei: 1n, sellerNetWei: 38n });
    assert.deepEqual(ahFeeSplit(40n), { feeWei: 2n, sellerNetWei: 38n });
  });

  it("partitions price for larger amounts", () => {
    const price = 10n ** 18n; // 1 ETH
    const { feeWei, sellerNetWei } = ahFeeSplit(price);
    assert.equal(feeWei, 5n * 10n ** 16n); // 0.05 ETH
    assert.equal(sellerNetWei, price - feeWei);
    assert.equal(feeWei + sellerNetWei, price);
  });

  it("splits the 5% fee into 250 bps vault and 250 bps treasury, floored", () => {
    assert.equal(AH_VAULT_FEE_BPS, 250);
    assert.equal(AH_TREASURY_FEE_BPS, 250);
    assert.equal(AH_VAULT_FEE_BPS + AH_TREASURY_FEE_BPS, AH_FEE_BPS);
    assert.equal(AH_FEE_BPS, 500);
    assert.deepEqual(ahGuildFeeShares(0n), { feeWei: 0n, vaultWei: 0n, treasuryWei: 0n });
    assert.deepEqual(ahGuildFeeShares(1n), { feeWei: 0n, vaultWei: 0n, treasuryWei: 0n });
    assert.deepEqual(ahGuildFeeShares(19n), { feeWei: 0n, vaultWei: 0n, treasuryWei: 0n });
    assert.deepEqual(ahGuildFeeShares(20n), { feeWei: 1n, vaultWei: 0n, treasuryWei: 1n });
    assert.deepEqual(ahGuildFeeShares(40n), { feeWei: 2n, vaultWei: 1n, treasuryWei: 1n });
    assert.deepEqual(ahGuildFeeShares(60n), { feeWei: 3n, vaultWei: 1n, treasuryWei: 2n });
    assert.deepEqual(ahGuildFeeShares(10_000n), { feeWei: 500n, vaultWei: 250n, treasuryWei: 250n });
    const price = 10n ** 18n;
    const shares = ahGuildFeeShares(price);
    assert.equal(shares.feeWei, 5n * 10n ** 16n);
    assert.equal(shares.vaultWei, 25n * 10n ** 15n);
    assert.equal(shares.treasuryWei, 25n * 10n ** 15n);
    assert.equal(shares.vaultWei + shares.treasuryWei, shares.feeWei);
  });
});

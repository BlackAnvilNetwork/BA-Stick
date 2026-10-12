import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveListSellerPayout } from "./lok-vault";

describe("resolveListSellerPayout (mainnet rule 2/4)", () => {
  it("uses ownerOf and never a client-supplied address", () => {
    const owner = "0x1111111111111111111111111111111111111111";
    const r = resolveListSellerPayout(owner);
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.payout, owner.toLowerCase());
  });

  it("lowercases the owner address", () => {
    const r = resolveListSellerPayout("0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.payout, "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  });

  it("refuses a missing owner", () => {
    const r = resolveListSellerPayout(null);
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /owner could not be read/i);
  });

  it("refuses a non-address owner", () => {
    const r = resolveListSellerPayout("not-an-address");
    assert.equal(r.ok, false);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { privateKeyToAccount } from "viem/accounts";
import { acceptedMintWallets, mintClaimMessage, verifyMintClaim } from "./mint-claim";

const KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;

describe("mint claim (H1)", () => {
  it("auth-only wallets need no signature", async () => {
    const r = await acceptedMintWallets({
      authWallet: "0x1111111111111111111111111111111111111111",
    });
    assert.equal(r.ok, true);
    if (r.ok) assert.deepEqual(r.wallets, ["0x1111111111111111111111111111111111111111"]);
  });

  it("rejects expired claims", async () => {
    const acct = privateKeyToAccount(KEY);
    const expiry = Math.floor(Date.now() / 1000) - 10;
    const message = mintClaimMessage({
      tokenId: "1",
      gameWallet: "0x2222222222222222222222222222222222222222",
      chainId: 31337,
      charId: "Chrona",
      nonce: "abcd1234",
      expiry,
    });
    const signature = await acct.signMessage({ message });
    const r = await verifyMintClaim({
      tokenId: "1",
      gameWallet: "0x2222222222222222222222222222222222222222",
      mintWallet: acct.address,
      chainId: 31337,
      charId: "Chrona",
      nonce: "abcd1234",
      expiry,
      signature,
    });
    assert.equal(r.ok, false);
  });
});

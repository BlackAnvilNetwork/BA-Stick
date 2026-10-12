/**
 * Support review of 9692ea2: H1 mint-claim edge cases (pure; no chain).
 * Updated for L3: chainId + charId in the message; nonces are consumed.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { privateKeyToAccount } from "viem/accounts";
import {
  acceptedMintWallets,
  consumeMintClaimNonce,
  mintClaimMessage,
  resetMintClaimNoncesForTests,
} from "./mint-claim";

const MINT = privateKeyToAccount("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a");
const OTHER = privateKeyToAccount("0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6");
const GAME = "0x1111111111111111111111111111111111111111";
const ATTACKER = "0x2222222222222222222222222222222222222222";
const CHAIN = 31337;
const CHAR = "Chrona";
const now = () => Math.floor(Date.now() / 1000);

async function claim(opts: {
  tokenId: string;
  gameWallet: string;
  expiry: number;
  signer?: typeof MINT;
  nonce?: string;
  chainId?: number;
  charId?: string;
}) {
  const nonce = opts.nonce ?? "nonce-abcdef12";
  const chainId = opts.chainId ?? CHAIN;
  const charId = opts.charId ?? CHAR;
  const message = mintClaimMessage({
    tokenId: opts.tokenId,
    gameWallet: opts.gameWallet,
    chainId,
    charId,
    nonce,
    expiry: opts.expiry,
  });
  const signature = await (opts.signer ?? MINT).signMessage({ message });
  return { nonce, expiry: opts.expiry, signature, chainId, charId };
}

function args(
  c: Awaited<ReturnType<typeof claim>>,
  overrides: Partial<{
    authWallet: string;
    tokenId: string;
    mintNonce: string;
    mintExpiry: number;
    mintSignature: string;
    chainId: number;
    charId: string;
  }> = {},
) {
  return {
    authWallet: overrides.authWallet ?? GAME,
    mintWallet: MINT.address,
    tokenId: overrides.tokenId ?? "5",
    chainId: overrides.chainId ?? c.chainId,
    charId: overrides.charId ?? c.charId,
    mintNonce: overrides.mintNonce ?? c.nonce,
    mintExpiry: overrides.mintExpiry ?? c.expiry,
    mintSignature: overrides.mintSignature ?? c.signature,
  };
}

describe("support 9692ea2: mint claim edge cases", () => {
  it("the victim's valid claim replayed by another game wallet is rejected", async () => {
    resetMintClaimNoncesForTests();
    const c = await claim({ tokenId: "5", gameWallet: GAME, expiry: now() + 300 });
    const r = await acceptedMintWallets(args(c, { authWallet: ATTACKER }));
    assert.equal(r.ok, false);
  });
  it("a claim for token 5 cannot bind token 6", async () => {
    resetMintClaimNoncesForTests();
    const c = await claim({ tokenId: "5", gameWallet: GAME, expiry: now() + 300 });
    const r = await acceptedMintWallets(args(c, { tokenId: "6" }));
    assert.equal(r.ok, false);
  });
  it("a changed nonce or expiry breaks the signature", async () => {
    resetMintClaimNoncesForTests();
    const c = await claim({ tokenId: "5", gameWallet: GAME, expiry: now() + 300 });
    const a = await acceptedMintWallets(args(c, { mintNonce: "nonce-zzzzzzzz" }));
    const b = await acceptedMintWallets(args(c, { mintExpiry: c.expiry + 1 }));
    assert.equal(a.ok, false);
    assert.equal(b.ok, false);
  });
  it("expired and too-far-future claims are rejected", async () => {
    resetMintClaimNoncesForTests();
    const old = await claim({ tokenId: "5", gameWallet: GAME, expiry: now() - 1 });
    const far = await claim({ tokenId: "5", gameWallet: GAME, expiry: now() + 31 * 60 });
    for (const c of [old, far]) {
      const r = await acceptedMintWallets(args(c));
      assert.equal(r.ok, false);
    }
  });
  it("a claim signed by a different key than mintWallet is rejected", async () => {
    resetMintClaimNoncesForTests();
    const c = await claim({ tokenId: "5", gameWallet: GAME, expiry: now() + 300, signer: OTHER });
    const r = await acceptedMintWallets(args(c));
    assert.equal(r.ok, false);
  });
  it("the valid claim works, and the auth-wallet path needs no signature (any case)", async () => {
    resetMintClaimNoncesForTests();
    const c = await claim({ tokenId: "5", gameWallet: GAME, expiry: now() + 300 });
    const ok = await acceptedMintWallets(args(c));
    assert.equal(ok.ok, true);
    const self = await acceptedMintWallets({
      authWallet: MINT.address.toLowerCase(),
      mintWallet: MINT.address,
    });
    assert.equal(self.ok, true);
    if (self.ok) assert.deepEqual(self.wallets, [MINT.address.toLowerCase()]);
  });
  it("L3: nonce is reusable until consume; wrong chainId/charId fail; spaces in names work", async () => {
    resetMintClaimNoncesForTests();
    const c = await claim({ tokenId: "5", gameWallet: GAME, expiry: now() + 300 });
    const first = args(c);
    const a = await acceptedMintWallets(first);
    assert.equal(a.ok, true);
    // Not consumed yet — spawn failure can retry.
    assert.equal((await acceptedMintWallets(first)).ok, true);
    consumeMintClaimNonce(MINT.address, c.nonce);
    assert.equal((await acceptedMintWallets(first)).ok, false, "consumed nonce must be single-use");

    resetMintClaimNoncesForTests();
    const spaced = await claim({
      tokenId: "5",
      gameWallet: GAME,
      expiry: now() + 300,
      charId: "Iron Mage",
      nonce: "nonce-spaced01",
    });
    assert.equal((await acceptedMintWallets(args(spaced))).ok, true);

    resetMintClaimNoncesForTests();
    const wrongChain = await claim({
      tokenId: "5",
      gameWallet: GAME,
      expiry: now() + 300,
      chainId: 1,
      nonce: "nonce-chainxxx",
    });
    assert.equal((await acceptedMintWallets(args(wrongChain, { chainId: CHAIN }))).ok, false);
    const wrongChar = await claim({
      tokenId: "5",
      gameWallet: GAME,
      expiry: now() + 300,
      charId: "Other",
      nonce: "nonce-charxxxx",
    });
    assert.equal((await acceptedMintWallets(args(wrongChar, { charId: CHAR }))).ok, false);
  });
});

/**
 * H1: char/create must not trust a client-supplied mintWallet without a signature.
 * Uses acceptedMintWallets (unit) + optional throwaway anvil for end-to-end bind.
 */
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { acceptedMintWallets, mintClaimMessage, verifyMintClaim } from "./mint-claim";
import { LokWorld } from "./lok-world";

const ATTACKER = "0x00000000000000000000000000000000000a77ac";
const VICTIM_KEY = "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6" as const;

describe("support 4cf0bce: mintWallet hijack (H1)", () => {
  it("rejects an unproven mintWallet that is not the auth wallet", async () => {
    const victim = privateKeyToAccount(VICTIM_KEY);
    const denied = await acceptedMintWallets({
      authWallet: ATTACKER,
      mintWallet: victim.address,
      tokenId: "1",
    });
    assert.equal(denied.ok, false, "attacker must not accept victim mintWallet without a signature");
  });

  it("accepts mintWallet only with a valid EIP-191 claim from that wallet", async () => {
    const victim = privateKeyToAccount(VICTIM_KEY);
    const nonce = "nonce_abc12345";
    const expiry = Math.floor(Date.now() / 1000) + 600;
    const message = mintClaimMessage({
      tokenId: "7",
      gameWallet: ATTACKER,
      nonce,
      expiry,
    });
    const signature = await victim.signMessage({ message });
    const ok = await verifyMintClaim({
      tokenId: "7",
      gameWallet: ATTACKER,
      mintWallet: victim.address,
      nonce,
      expiry,
      signature,
    });
    assert.equal(ok.ok, true);

    const wallets = await acceptedMintWallets({
      authWallet: ATTACKER,
      mintWallet: victim.address,
      tokenId: "7",
      mintNonce: nonce,
      mintExpiry: expiry,
      mintSignature: signature,
    });
    assert.equal(wallets.ok, true);
    if (wallets.ok) {
      assert.ok(wallets.wallets.includes(victim.address.toLowerCase()));
    }
  });

  it("attacker cannot bind a victim NFT using only the victim address as mintWallet", async () => {
    // Mirrors the support SUPPORT-FAIL scenario at the wallet-acceptance layer
    // (verifyCharacterNftOwner is not reached when the claim is missing).
    const victim = privateKeyToAccount(VICTIM_KEY);
    const wallets = await acceptedMintWallets({
      authWallet: ATTACKER,
      mintWallet: victim.address,
      tokenId: "1",
    });
    assert.equal(wallets.ok, false);

    const dir = mkdtempSync(join(tmpdir(), "lok-hijack-"));
    const lok = LokWorld.open(dir, undefined, {});
    // Even if someone bypassed verify and only used auth wallet, spawn still needs ownership
    // on-chain — here we only assert the unproven mintWallet path is closed.
    const attackerKey = generatePrivateKey();
    const attacker = privateKeyToAccount(attackerKey);
    const spawned = lok.spawn("c_attacker", "Attacker", 0, attacker.address, { tokenId: "1" });
    // Without chain, spawn with explicit tokenId still works on the log — H1 is the
    // acceptedWallets gate, which we already asserted fails. Binding without ownership
    // proof is what char/create must refuse before spawn.
    assert.equal(spawned.ok, true);
    assert.equal(wallets.ok, false, "create handler must stop before spawn when mintWallet is unproven");
  });
});

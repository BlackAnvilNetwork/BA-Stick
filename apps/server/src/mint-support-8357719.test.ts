/**
 * Support review of 8357719: L3 mint-claim replay / cross-chain / charId, and M-A on a NEW factory.
 * The factory case needs LOK_SUPPORT_RPC + LOK_SUPPORT_NEW_FACTORY (MintFixture on a throwaway anvil).
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { privateKeyToAccount } from "viem/accounts";
import { normalizeCharacterName } from "./character-name";
import { factorySupportsCreateFor } from "./lok-vault";
import {
  acceptedMintWallets,
  consumeMintClaimNonce,
  mintClaimMessage,
  resetMintClaimNoncesForTests,
} from "./mint-claim";
import {
  deployMintFixture,
  startThrowawayAnvil,
  supportAnvilAvailable,
  type ThrowawayAnvil,
} from "./support-anvil";

const MINT = privateKeyToAccount("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a");
const GAME = "0x1111111111111111111111111111111111111111";
const ENV_RPC = process.env.LOK_SUPPORT_RPC ?? "";
const ENV_NEW = process.env.LOK_SUPPORT_NEW_FACTORY ?? "";
const canRunFactory = !!(ENV_RPC && ENV_NEW) || supportAnvilAvailable;

async function args(o: { chainId: number; charId: string; tokenId?: string; nonce?: string }) {
  const expiry = Math.floor(Date.now() / 1000) + 300;
  const nonce = o.nonce ?? "nonce-" + Math.random().toString(36).slice(2, 12);
  const tokenId = o.tokenId ?? "7";
  const signature = await MINT.signMessage({ message: mintClaimMessage({ tokenId, gameWallet: GAME, chainId: o.chainId, charId: o.charId, nonce, expiry }) });
  return { authWallet: GAME, mintWallet: MINT.address, tokenId, chainId: o.chainId, charId: o.charId, mintNonce: nonce, mintExpiry: expiry, mintSignature: signature };
}

describe("support 8357719: mint claim L3 + M-A", () => {
  let owned: ThrowawayAnvil | undefined;
  let RPC = ENV_RPC;
  let NEW_FACTORY = ENV_NEW;

  before(async () => {
    if (ENV_RPC && ENV_NEW) return;
    if (!supportAnvilAvailable) return;
    owned = await startThrowawayAnvil();
    RPC = owned.rpc;
    NEW_FACTORY = deployMintFixture(RPC).factory;
  });

  after(() => {
    owned?.stop();
  });

  it("a claim is reusable until spawn consumes the nonce, then rejected", async () => {
    resetMintClaimNoncesForTests();
    const a = await args({ chainId: 31337, charId: "Chrona" });
    const first = await acceptedMintWallets(a);
    assert.equal(first.ok, true);
    assert.equal((await acceptedMintWallets(a)).ok, true, "retry before spawn still works");
    if (!first.ok || !first.pendingNonce) throw new Error("expected pending nonce");
    consumeMintClaimNonce(first.pendingNonce.mintWallet, first.pendingNonce.nonce);
    assert.equal((await acceptedMintWallets(a)).ok, false, "rejected after spawn consume");
  });
  it("a claim signed for chain 1 does not verify as chain 31337", async () => {
    const a = await args({ chainId: 1, charId: "Chrona" });
    assert.equal((await acceptedMintWallets({ ...a, chainId: 31337 })).ok, false);
  });
  it("a claim for one character name cannot create another", async () => {
    const a = await args({ chainId: 31337, charId: "Chrona" });
    assert.equal((await acceptedMintWallets({ ...a, charId: "Other" })).ok, false);
  });
  it("SUPPORT-FAIL: a valid character name with a space can be claimed", async () => {
    const named = normalizeCharacterName("Iron Mage");
    assert.equal(named.ok, true, "server accepts the name");
    const a = await args({ chainId: 31337, charId: (named as { name: string }).name });
    const r = await acceptedMintWallets(a);
    assert.equal(r.ok, true, "claim for a legal name is rejected after the fee was paid: " + JSON.stringify(r));
  });
  it("SUPPORT-FAIL: factorySupportsCreateFor is true for a factory that has createCharacterFor", {
    skip: !canRunFactory,
  }, async () => {
    assert.ok(RPC && NEW_FACTORY, "MintFixture missing addresses");
    assert.equal(await factorySupportsCreateFor(RPC, NEW_FACTORY, 31337), true);
  });
});

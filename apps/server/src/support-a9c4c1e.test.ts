/**
 * Support review of a9c4c1e: nonce consume-after-spawn + persistence, M-A on an OLD factory,
 * M-D gates. Factory cases need LOK_SUPPORT_RPC + LOK_SUPPORT_OLD_FACTORY.
 */
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { privateKeyToAccount } from "viem/accounts";
import { eezZoneConfig, planEezSyncBuy, verifyEezMockOnchain } from "./eez-sync";
import { factorySupportsCreateFor } from "./lok-vault";
import { acceptedMintWallets, configureMintClaimNonceStore, consumeMintClaimNonce, mintClaimMessage, resetMintClaimNoncesForTests } from "./mint-claim";

const MINT = privateKeyToAccount("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a");
const GAME = "0x1111111111111111111111111111111111111111";
const RPC = process.env.LOK_SUPPORT_RPC ?? "";
const OLD = process.env.LOK_SUPPORT_OLD_FACTORY ?? "";
const ESCROW = process.env.LOK_SUPPORT_ESCROW ?? "";
const MOCK = process.env.LOK_SUPPORT_EEZ_MOCK ?? "";

async function claimArgs(charId = "Iron Mage") {
  const expiry = Math.floor(Date.now() / 1000) + 300;
  const nonce = "nonce-" + Math.random().toString(36).slice(2, 12);
  const signature = await MINT.signMessage({ message: mintClaimMessage({ tokenId: "7", gameWallet: GAME, chainId: 31337, charId, nonce, expiry }) });
  return { authWallet: GAME, mintWallet: MINT.address, tokenId: "7", chainId: 31337, charId, mintNonce: nonce, mintExpiry: expiry, mintSignature: signature };
}

describe("support a9c4c1e", () => {
  it("a claim is reusable until spawn consumes it, then rejected, also after a restart", async () => {
    resetMintClaimNoncesForTests();
    const store = join(mkdtempSync(join(tmpdir(), "nonce-")), "mint-claim-nonces.json");
    configureMintClaimNonceStore(store);
    const a = await claimArgs();
    const first = await acceptedMintWallets(a);
    assert.equal(first.ok, true);
    assert.equal((await acceptedMintWallets(a)).ok, true, "retry before spawn still works");
    const p = (first as { pendingNonce: { mintWallet: string; nonce: string } }).pendingNonce;
    consumeMintClaimNonce(p.mintWallet, p.nonce);
    assert.equal((await acceptedMintWallets(a)).ok, false, "rejected after spawn");
    resetMintClaimNoncesForTests();
    configureMintClaimNonceStore(store);
    assert.equal((await acceptedMintWallets(a)).ok, false, "rejected after restart (persisted)");
  });
  it("M-A: an old factory without createCharacterFor reports false", { skip: !RPC || !OLD }, async () => {
    assert.equal(await factorySupportsCreateFor(RPC, OLD, 31337), false);
  });
  it("M-D: mock path is off for chain 1 / non-local RPC", () => {
    const base = { LOK_EEZ_SYNC_BUY: "1", LOK_EEZ_ZONE_ID: "z", LOK_EEZ_MOCK_SYNC_BUY: "0x" + "ab".repeat(20), LOK_AH_ESCROW: "0x" + "cd".repeat(20) };
    for (const env of [
      { ...base, LOK_CHAIN_RPC: "https://mainnet.example", LOK_CHAIN_ID: "1" },
      { ...base, LOK_CHAIN_RPC: "https://rpc.example", LOK_CHAIN_ID: "31337" },
      { ...base, LOK_CHAIN_RPC: "http://127.0.0.1:8545", LOK_CHAIN_ID: "1" },
      { ...base, LOK_CHAIN_RPC: "http://127.0.0.1:8545", LOK_PUBLIC_RPC: "https://public.example" },
    ]) {
      assert.equal(eezZoneConfig(env as NodeJS.ProcessEnv).syncBuyEnabled, false, JSON.stringify(env));
      assert.equal(planEezSyncBuy({ listingId: "1", priceWei: "1", buyerTokenId: "2", homeChainId: 31337 }, env as NodeJS.ProcessEnv).ok, false);
    }
  });
  it("M-D: on-chain verify accepts the real mock and rejects a mock for another escrow / no code", { skip: !RPC || !ESCROW || !MOCK }, async () => {
    const env = { LOK_EEZ_SYNC_BUY: "1", LOK_EEZ_ZONE_ID: "z", LOK_CHAIN_RPC: RPC, LOK_CHAIN_ID: "31337", LOK_AH_ESCROW: ESCROW };
    assert.equal((await verifyEezMockOnchain({ ...env, LOK_EEZ_MOCK_SYNC_BUY: MOCK } as NodeJS.ProcessEnv)).ok, true);
    assert.equal((await verifyEezMockOnchain({ ...env, LOK_EEZ_MOCK_SYNC_BUY: "0x" + "ee".repeat(20) } as NodeJS.ProcessEnv)).ok, false);
    assert.equal((await verifyEezMockOnchain({ ...env, LOK_AH_ESCROW: "0x" + "cd".repeat(20), LOK_EEZ_MOCK_SYNC_BUY: MOCK } as NodeJS.ProcessEnv)).ok, false);
  });
});

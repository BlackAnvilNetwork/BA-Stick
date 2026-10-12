/**
 * EIP-191 proof that mintWallet authorizes binding an NFT to a game auth wallet.
 * Prevents H1: an attacker naming a victim's address as mintWallet.
 *
 * Claims include chainId + charId (defense in depth). Nonces are reserved on
 * verify and consumed only after a successful spawn (so a post-pay create failure
 * can retry). Optionally persisted under the lok data dir.
 */
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { normalizeCharacterName } from "@bellgrave/config";
import { verifyMessage } from "viem";

export type MintClaim = {
  tokenId: string;
  gameWallet: string;
  mintWallet: string;
  chainId: number;
  charId: string;
  nonce: string;
  expiry: number;
  signature: string;
};

/** Consumed mint-claim nonces (mintWallet:nonce). */
const usedMintNonces = new Set<string>();
let mintNonceStorePath: string | null = null;

function nonceKey(mintWallet: string, nonce: string): string {
  return mintWallet.toLowerCase() + ":" + nonce;
}

function persistMintNonces(): void {
  if (!mintNonceStorePath) return;
  const tmp = mintNonceStorePath + ".tmp";
  writeFileSync(tmp, JSON.stringify({ nonces: [...usedMintNonces] }));
  renameSync(tmp, mintNonceStorePath);
}

/** Load / attach an on-disk nonce store (boot). Safe to call more than once. */
export function configureMintClaimNonceStore(path: string): void {
  mintNonceStorePath = path;
  if (!existsSync(path)) return;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as { nonces?: unknown };
    if (!Array.isArray(parsed.nonces)) return;
    for (const n of parsed.nonces) {
      if (typeof n === "string" && n.includes(":")) usedMintNonces.add(n);
    }
  } catch {
    /* ignore corrupt store */
  }
}

export function resetMintClaimNoncesForTests(): void {
  usedMintNonces.clear();
  mintNonceStorePath = null;
}

export function consumeMintClaimNonce(mintWallet: string, nonce: string): void {
  usedMintNonces.add(nonceKey(mintWallet, nonce));
  persistMintNonces();
}

export function mintClaimMessage(opts: {
  tokenId: string;
  gameWallet: string;
  chainId: number;
  charId: string;
  nonce: string;
  expiry: number;
}): string {
  return [
    "Bellgrave character mint claim",
    "tokenId: " + opts.tokenId,
    "gameWallet: " + opts.gameWallet.toLowerCase(),
    "chainId: " + String(opts.chainId),
    "charId: " + opts.charId,
    "nonce: " + opts.nonce,
    "expiry: " + String(opts.expiry),
  ].join("\n");
}

export async function verifyMintClaim(
  claim: MintClaim,
  nowSec: number = Math.floor(Date.now() / 1000),
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!/^[1-9][0-9]{0,77}$/.test(claim.tokenId)) {
    return { ok: false, error: "Bad mint claim token id." };
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(claim.gameWallet) || !/^0x[0-9a-fA-F]{40}$/.test(claim.mintWallet)) {
    return { ok: false, error: "Bad mint claim wallet." };
  }
  if (!Number.isSafeInteger(claim.chainId) || claim.chainId <= 0) {
    return { ok: false, error: "Bad mint claim chain id." };
  }
  const named = normalizeCharacterName(claim.charId);
  if (!named.ok) {
    return { ok: false, error: "Bad mint claim char id: " + named.error };
  }
  if (named.name !== claim.charId) {
    return { ok: false, error: "Mint claim char id must be the normalized character name." };
  }
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(claim.nonce)) {
    return { ok: false, error: "Bad mint claim nonce." };
  }
  if (!Number.isSafeInteger(claim.expiry) || claim.expiry < nowSec) {
    return { ok: false, error: "Mint claim expired." };
  }
  if (claim.expiry > nowSec + 30 * 60) {
    return { ok: false, error: "Mint claim expiry is too far in the future." };
  }
  if (!/^0x[0-9a-fA-F]+$/.test(claim.signature) || claim.signature.length < 130) {
    return { ok: false, error: "Bad mint claim signature." };
  }
  if (usedMintNonces.has(nonceKey(claim.mintWallet, claim.nonce))) {
    return { ok: false, error: "Mint claim nonce already used." };
  }
  const message = mintClaimMessage({
    tokenId: claim.tokenId,
    gameWallet: claim.gameWallet,
    chainId: claim.chainId,
    charId: claim.charId,
    nonce: claim.nonce,
    expiry: claim.expiry,
  });
  try {
    const ok = await verifyMessage({
      address: claim.mintWallet as `0x${string}`,
      message,
      signature: claim.signature as `0x${string}`,
    });
    if (!ok) return { ok: false, error: "Mint claim signature does not match mintWallet." };
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: "Mint claim signature check failed: " + (err instanceof Error ? err.message : String(err)),
    };
  }
}

/**
 * Resolve which wallets may own the NFT for mint-first create.
 * - Auth wallet always (already signed into the game).
 * - mintWallet only when it equals auth, or when a valid claim signature is provided.
 * Does not consume the nonce — call consumeMintClaimNonce after a successful spawn.
 */
export async function acceptedMintWallets(opts: {
  authWallet: string;
  mintWallet?: string;
  tokenId?: string;
  chainId?: number;
  charId?: string;
  mintNonce?: string;
  mintExpiry?: number;
  mintSignature?: string;
}): Promise<
  | { ok: true; wallets: string[]; pendingNonce?: { mintWallet: string; nonce: string } }
  | { ok: false; error: string }
> {
  const auth = opts.authWallet.toLowerCase();
  const wallets = new Set<string>([auth]);
  const mint = opts.mintWallet?.trim().toLowerCase();
  if (!mint || mint === auth) return { ok: true, wallets: [...wallets] };
  if (
    !opts.tokenId ||
    opts.chainId == null ||
    !opts.charId ||
    !opts.mintNonce ||
    opts.mintExpiry == null ||
    !opts.mintSignature
  ) {
    return {
      ok: false,
      error:
        "mintWallet differs from your login wallet; sign a mint claim (tokenId + game wallet + chainId + charId) from that wallet.",
    };
  }
  const verified = await verifyMintClaim({
    tokenId: opts.tokenId,
    gameWallet: auth,
    mintWallet: mint,
    chainId: opts.chainId,
    charId: opts.charId,
    nonce: opts.mintNonce,
    expiry: opts.mintExpiry,
    signature: opts.mintSignature,
  });
  if (!verified.ok) return verified;
  wallets.add(mint);
  return {
    ok: true,
    wallets: [...wallets],
    pendingNonce: { mintWallet: mint, nonce: opts.mintNonce },
  };
}

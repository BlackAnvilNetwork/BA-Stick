/**
 * EIP-191 proof that mintWallet authorizes binding an NFT to a game auth wallet.
 * Prevents H1: an attacker naming a victim's address as mintWallet.
 *
 * Claims include chainId + charId (defense in depth) and consumed nonces (L3).
 */
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

/** Consumed mint-claim nonces (mintWallet:nonce). In-memory; process lifetime. */
const usedMintNonces = new Set<string>();

export function resetMintClaimNoncesForTests(): void {
  usedMintNonces.clear();
}

function nonceKey(mintWallet: string, nonce: string): string {
  return mintWallet.toLowerCase() + ":" + nonce;
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
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(claim.charId)) {
    return { ok: false, error: "Bad mint claim char id." };
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
 * On success, the claim nonce is consumed so the same claim cannot be replayed.
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
}): Promise<{ ok: true; wallets: string[] } | { ok: false; error: string }> {
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
  usedMintNonces.add(nonceKey(mint, opts.mintNonce));
  wallets.add(mint);
  return { ok: true, wallets: [...wallets] };
}

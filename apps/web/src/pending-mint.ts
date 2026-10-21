/**
 * Remember an already-paid, unbound character NFT so a create failure after
 * payment can retry without charging twice (M-C).
 */
export type PendingMint = {
  tokenId: string;
  payer: string;
  chainId: number;
  factory: string;
  nft: string;
  gameWallet: string;
};

function storageKey(gameWallet: string): string {
  return "bellgrave:pendingMint:" + gameWallet.toLowerCase();
}

export function readPendingMint(gameWallet: string): PendingMint | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(gameWallet));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingMint;
    if (
      !parsed ||
      !/^[1-9][0-9]{0,77}$/.test(parsed.tokenId) ||
      !/^0x[0-9a-fA-F]{40}$/.test(parsed.payer) ||
      !/^0x[0-9a-fA-F]{40}$/.test(parsed.factory) ||
      !/^0x[0-9a-fA-F]{40}$/.test(parsed.nft) ||
      !Number.isSafeInteger(parsed.chainId)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writePendingMint(pending: PendingMint): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(storageKey(pending.gameWallet), JSON.stringify(pending));
}

export function clearPendingMint(gameWallet: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(storageKey(gameWallet));
}

/** M-F: drop a pending paid mint once its token is bound on the roster. */
export function clearPendingMintIfTokenBound(
  gameWallet: string,
  rosterTokenIds: ReadonlyArray<string | undefined | null>,
): void {
  const pending = readPendingMint(gameWallet);
  if (!pending) return;
  if (rosterTokenIds.some((id) => id === pending.tokenId)) {
    clearPendingMint(gameWallet);
  }
}

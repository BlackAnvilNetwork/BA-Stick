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

function storageKey(wallet: string): string {
  return "bellgrave:pendingMint:" + wallet.toLowerCase();
}

function parsePending(raw: string | null): PendingMint | null {
  if (!raw) return null;
  try {
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

/** Look up a pending mint under the game session and/or the paying wallet. */
export function readPendingMint(...wallets: Array<string | null | undefined>): PendingMint | null {
  if (typeof localStorage === "undefined") return null;
  const seen = new Set<string>();
  for (const wallet of wallets) {
    if (!wallet || !/^0x[0-9a-fA-F]{40}$/.test(wallet)) continue;
    const key = wallet.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const found = parsePending(localStorage.getItem(storageKey(key)));
    if (found) return found;
  }
  return null;
}

export function writePendingMint(pending: PendingMint): void {
  if (typeof localStorage === "undefined") return;
  const json = JSON.stringify(pending);
  localStorage.setItem(storageKey(pending.gameWallet), json);
  if (pending.payer.toLowerCase() !== pending.gameWallet.toLowerCase()) {
    localStorage.setItem(storageKey(pending.payer), json);
  }
}

export function clearPendingMint(...wallets: Array<string | null | undefined>): void {
  if (typeof localStorage === "undefined") return;
  const seen = new Set<string>();
  for (const wallet of wallets) {
    if (!wallet || !/^0x[0-9a-fA-F]{40}$/.test(wallet)) continue;
    const pending = parsePending(localStorage.getItem(storageKey(wallet)));
    if (pending) {
      seen.add(pending.gameWallet.toLowerCase());
      seen.add(pending.payer.toLowerCase());
    }
    seen.add(wallet.toLowerCase());
  }
  for (const key of seen) localStorage.removeItem(storageKey(key));
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

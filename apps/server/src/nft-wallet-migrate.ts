/**
 * One-off / boot migration: rebind log character wallets to live CharacterNFT ownerOf.
 * Fixes burner-bound rows when the NFT is held by a different wallet (C-1 re-test #3).
 */
import { readCharacterNftOwner } from "./lok-vault";
import type { LokWorld } from "./lok-world";
import { nftOwnerCache } from "./nft-owner-cache";
import { opsAlert } from "./ops-log";

export type MigrateResult = {
  checked: number;
  rebound: number;
  skipped: number;
  errors: string[];
};

export async function migrateCharacterWalletsToNftOwners(
  lok: Pick<LokWorld, "boundChars" | "rebindWallet">,
  opts?: { env?: NodeJS.ProcessEnv; dataDir?: string },
): Promise<MigrateResult> {
  const out: MigrateResult = { checked: 0, rebound: 0, skipped: 0, errors: [] };
  const chars = lok.boundChars();
  for (const row of chars) {
    if (!row.tokenId || !/^[1-9][0-9]{0,77}$/.test(row.tokenId)) {
      out.skipped += 1;
      continue;
    }
    out.checked += 1;
    const live = await readCharacterNftOwner(row.tokenId, opts?.env);
    if (!live.ok) {
      out.errors.push("#" + row.tokenId + ": " + live.error);
      continue;
    }
    const owner = live.holder.toLowerCase();
    nftOwnerCache(opts?.dataDir).set(row.tokenId, owner, 0);
    const current = row.wallet?.toLowerCase() ?? null;
    if (current === owner) {
      out.skipped += 1;
      continue;
    }
    const reb = lok.rebindWallet(row.charId, owner);
    if (!reb.ok) {
      out.errors.push(row.charId + ": " + reb.error);
      continue;
    }
    out.rebound += 1;
    console.log(
      "[bellgrave] C-1 migrate rebind char=" +
        row.charId +
        " token=" +
        row.tokenId +
        " " +
        (reb.previous ?? "null") +
        " → " +
        owner,
    );
  }
  if (out.rebound > 0) {
    opsAlert({
      level: "info",
      event: "ops",
      msg: "C-1 wallet migration rebound " + out.rebound + " character(s)",
      rebound: out.rebound,
      checked: out.checked,
      dedupeKey: "c1-migrate:" + out.rebound,
    });
  }
  return out;
}

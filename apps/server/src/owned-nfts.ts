/**
 * Wallet Character NFTs: scan ownerOf, bind names for minted-but-unbound tokens.
 */
import { normalizeCharacterName } from "@bellgrave/config";

export type OwnedCharacterNft = {
  tokenId: string;
  job: number;
  level: number;
};

export function ownedNftScanLastId(nextTokenId: bigint, suggestedTokenId?: string): bigint {
  let last = nextTokenId > 0n ? nextTokenId : 0n;
  if (suggestedTokenId && /^[1-9][0-9]{0,77}$/.test(suggestedTokenId)) {
    try {
      const suggested = BigInt(suggestedTokenId);
      if (suggested > last) last = suggested;
    } catch {
      /* ignore */
    }
  }
  return last;
}

export async function collectOwnedCharacterNfts(opts: {
  owner: string;
  lastId: bigint;
  ownerOf: (tokenId: bigint) => Promise<string>;
  summary?: (tokenId: bigint) => Promise<bigint>;
  maxScan?: number;
}): Promise<OwnedCharacterNft[]> {
  const owner = opts.owner.toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(owner) || opts.lastId < 1n) return [];
  const limit = Math.max(1, Math.min(opts.maxScan ?? 64, 64));
  const found: OwnedCharacterNft[] = [];
  let id = opts.lastId;
  for (let i = 0; i < limit && id >= 1n; i++, id -= 1n) {
    try {
      const held = (await opts.ownerOf(id)).toLowerCase();
      if (held !== owner) continue;
      let job = 0;
      let level = 1;
      if (opts.summary) {
        try {
          const summary = await opts.summary(id);
          job = Number((summary >> 16n) & 0xffn);
          const lv = Number(summary & 0xffffn);
          if (Number.isFinite(lv) && lv > 0) level = lv;
        } catch {
          /* genesis unread — still list the NFT */
        }
      }
      found.push({ tokenId: id.toString(), job, level });
    } catch {
      /* token does not exist */
    }
  }
  return found.reverse();
}

export function pickUnboundOwnedNfts(
  owned: readonly OwnedCharacterNft[],
  boundTokenIds: ReadonlySet<string>,
): OwnedCharacterNft[] {
  return owned.filter((row) => !boundTokenIds.has(row.tokenId));
}

/** True when login auto-named this slot as `Job <tokenId>` / `JobTokenId`. */
export function isAutoTokenSuffixedName(name: string, jobName: string, tokenId: string): boolean {
  const compactJob = jobName.replace(/ /g, "");
  return name === `${jobName} ${tokenId}` || name === `${compactJob}${tokenId}`;
}

/** Job name only. Token id belongs on the roster as level, not in the name. */
export function ownedNftBindName(jobName: string, taken: (name: string) => boolean): string {
  const compactJob = jobName.replace(/ /g, "");
  const raws = [jobName, `New ${jobName}`, compactJob];
  for (const raw of raws) {
    const named = normalizeCharacterName(raw);
    if (named.ok && !taken(named.name)) return named.name;
  }
  for (let n = 0; n < 26; n++) {
    const named = normalizeCharacterName(`${jobName} ${String.fromCharCode(65 + n)}`);
    if (named.ok && !taken(named.name)) return named.name;
  }
  return jobName.slice(0, 16);
}

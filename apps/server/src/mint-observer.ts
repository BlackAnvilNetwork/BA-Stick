/**
 * A CharacterNFT mint is Transfer from the zero address.
 * The leader appends one spawn per token id. The journal command is only
 * { op: "spawn", tokenId, startingJob }. startingJob comes from
 * CharacterCheckpoint.summary, so the mint path and this observer write the
 * same entry. The chosen name stays in the bind file.
 *
 * A missing token whose mint log has not been scanned yet is unprocessed:
 * catch up, do not refuse. A missing token after a finished scan of its mint
 * log is history the journal does not have: refuse.
 */
import {
  decodeErc721Transfer,
  ERC721_TRANSFER_TOPIC,
  scanNftTransfers,
  type NftTransfer,
} from "./nft-transfer-ask-cancel";
import { preferFinalizedTip, settlementConfirmations } from "./settlement-confirmations";
import { settlementRpc, settlementSafeHead, watcherStartBlock } from "./settlement-rpc";
import { readCharacterGenesisJob } from "./lok-vault";
import { mintBecomesMissingHistory } from "./presence";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/** token id → mint recipient, or null when the log itself has not been read yet. */
const pendingMints = new Map<string, string | null>();

export function noteMintPending(tokenId: string, to: string | null): void {
  const id = tokenId.trim();
  if (!pendingMints.has(id)) pendingMints.set(id, to);
  else if (to && pendingMints.get(id) == null) pendingMints.set(id, to);
}

export function isMintTransfer(from: string): boolean {
  return from.trim().toLowerCase() === ZERO_ADDRESS;
}

/** Stable character id for a token first seen from a mint log or char/create. */
export function mintCharId(tokenId: string): string {
  return "chain_" + tokenId.trim();
}

export { summaryAheadOfJournal } from "./presence";

export function missingMintedTokenIds(known: ReadonlySet<string>, lastMintedId: bigint): string[] {
  const missing: string[] = [];
  if (lastMintedId < 1n) return missing;
  for (let id = 1n; id <= lastMintedId; id++) {
    const tokenId = id.toString();
    if (!known.has(tokenId)) missing.push(tokenId);
  }
  return missing;
}

export function classifyMintGap(args: {
  missingTokenIds: readonly string[];
  /** False when the mint logs could not be read through the safe head. */
  scanComplete: boolean;
  /** Mint log seen, but the genesis job could not be read or the spawn was not written. */
  unresolvedTokenIds: readonly string[];
}): { action: "ok" } | { action: "warn"; reason: string } | { action: "refuse"; missing: string[] } {
  const missing = [...args.missingTokenIds];
  const unresolved = [...args.unresolvedTokenIds];
  if (missing.length === 0 && unresolved.length === 0) return { action: "ok" };
  if (!args.scanComplete || unresolved.length > 0) {
    const parts = ["mint events not yet processed"];
    if (missing.length > 0) parts.push("missing " + missing.join(","));
    if (unresolved.length > 0) parts.push("unresolved " + unresolved.join(","));
    if (!args.scanComplete) parts.push("scan incomplete");
    return { action: "warn", reason: parts.join("; ") };
  }
  return { action: "refuse", missing };
}

export function mintLogTopics(tokenId: string): [string, string, null, string] {
  return [
    ERC721_TRANSFER_TOPIC,
    "0x" + "0".repeat(64),
    null,
    "0x" + BigInt(tokenId).toString(16).padStart(64, "0"),
  ];
}

type RpcLog = { topics?: string[]; blockNumber?: string };

/**
 * Page Transfer-from-zero logs for one token from the deploy block through
 * the safe head. `complete` is false when a page could not be read.
 */
function transferBlock(transfer: NftTransfer | null): bigint | null {
  if (!transfer?.blockNumber) return null;
  try {
    return BigInt(transfer.blockNumber);
  } catch {
    return null;
  }
}

let mintScannedTo = 0n;

/** Highest block the mint observer has scanned. Spawns are not taken from beyond it. */
export function mintCursor(): bigint {
  return mintScannedTo;
}

export async function findMintTransfer(
  tokenId: string,
  env: NodeJS.ProcessEnv,
  bounds?: { fromBlock?: bigint; toBlock?: bigint },
): Promise<{ complete: boolean; transfer: NftTransfer | null; scannedTo: bigint; tip: bigint; error?: string }> {
  const nft = env.LOK_NFT?.trim();
  if (!nft) {
    return { complete: false, transfer: null, scannedTo: 0n, tip: 0n, error: "Character NFT is not configured." };
  }
  try {
    const rpc = settlementRpc(env);
    const head = await settlementSafeHead({
      rpcCall: rpc.asCall(),
      confirmations: settlementConfirmations(env),
      preferFinalized: preferFinalizedTip(env),
    });
    const start = bounds?.fromBlock ?? watcherStartBlock(env);
    const limit = bounds?.toBlock ?? head.safeHead;
    mintScannedTo = head.safeHead;
    const page = 50_000n;
    let from = start > 0n ? start : 0n;
    if (from > limit) return { complete: true, transfer: null, scannedTo: head.safeHead, tip: head.tip };
    while (from <= limit) {
      const to = from + page - 1n > limit ? limit : from + page - 1n;
      const logs = (await rpc.asCall()("eth_getLogs", [
        {
          address: nft,
          fromBlock: "0x" + from.toString(16),
          toBlock: "0x" + to.toString(16),
          topics: mintLogTopics(tokenId),
        },
      ])) as RpcLog[];
      if (!Array.isArray(logs)) {
        return { complete: false, transfer: null, scannedTo: head.safeHead, tip: head.tip, error: "eth_getLogs returned no list" };
      }
      for (const log of logs) {
        const xfer = decodeErc721Transfer(log);
        if (xfer && isMintTransfer(xfer.from) && xfer.tokenId === tokenId) {
          const block = transferBlock(xfer);
          if (block != null && block > head.safeHead) {
            return { complete: true, transfer: xfer, scannedTo: head.safeHead, tip: head.tip };
          }
          return { complete: true, transfer: xfer, scannedTo: head.safeHead, tip: head.tip };
        }
      }
      from = to + 1n;
    }
    return { complete: true, transfer: null, scannedTo: head.safeHead, tip: head.tip };
  } catch (err) {
    return {
      complete: false,
      transfer: null,
      scannedTo: mintScannedTo,
      tip: 0n,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function backfillMintSpawns(
  lok: {
    charByTokenId(tokenId: string): { charId: string } | null;
    ensureMintedSpawn(
      tokenId: string,
      job: number,
      wallet?: string,
    ): { ok: true; created: boolean; charId: string } | { ok: false; error: string };
  },
  known: ReadonlySet<string>,
  lastMintedId: bigint,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ complete: boolean; created: string[]; unresolved: string[]; missing: string[]; holes: string[]; error?: string }> {
  const missingBefore = missingMintedTokenIds(known, lastMintedId);
  const created: string[] = [];
  const unresolved: string[] = [];
  const holes: string[] = [];
  let complete = true;
  let error: string | undefined;
  for (const tokenId of missingBefore) {
    const found = await findMintTransfer(tokenId, env);
    if (!found.complete) {
      complete = false;
      error = found.error;
      unresolved.push(tokenId);
      noteMintPending(tokenId, null);
      continue;
    }
    const confirmedBlock = transferBlock(found.transfer);
    if (found.transfer && confirmedBlock != null && confirmedBlock <= found.scannedTo) {
      // Confirmed mint. Fall through to the spawn below.
    } else {
      let unconfirmed: bigint | null = null;
      if (found.scannedTo < found.tip) {
        const tip = await findMintTransfer(tokenId, env, { fromBlock: found.scannedTo + 1n, toBlock: found.tip });
        if (!tip.complete) {
          complete = false;
          error = tip.error;
          unresolved.push(tokenId);
          noteMintPending(tokenId, null);
          continue;
        }
        unconfirmed = transferBlock(tip.transfer);
        if (tip.transfer) noteMintPending(tokenId, tip.transfer.to);
      }
      if (
        mintBecomesMissingHistory({
          inJournal: false,
          scanComplete: true,
          mintBlock: unconfirmed,
          scannedTo: found.scannedTo,
          tip: found.tip,
        })
      ) {
        holes.push(tokenId);
      } else {
        unresolved.push(tokenId);
      }
      continue;
    }
    if (!found.transfer) continue;
    const genesis = await readCharacterGenesisJob(tokenId, env);
    if (!genesis.ok) {
      unresolved.push(tokenId);
      noteMintPending(tokenId, found.transfer.to);
      console.error("[bellgrave] mint #" + tokenId + " seen but genesis job was not readable: " + genesis.error);
      continue;
    }
    const spawned = lok.ensureMintedSpawn(tokenId, genesis.job, found.transfer.to);
    if (!spawned.ok) {
      unresolved.push(tokenId);
      noteMintPending(tokenId, found.transfer.to);
      console.error("[bellgrave] mint #" + tokenId + " was not written: " + spawned.error);
      continue;
    }
    pendingMints.delete(tokenId);
    if (spawned.created) {
      created.push(tokenId);
      console.log(
        "[bellgrave] recorded mint #" + tokenId + " as " + spawned.charId + " job " + genesis.job,
      );
    }
  }
  const knownAfter = new Set(known);
  for (const tokenId of created) knownAfter.add(tokenId);
  for (const tokenId of missingBefore) {
    if (lok.charByTokenId(tokenId)) knownAfter.add(tokenId);
  }
    return {
    complete,
    created,
    unresolved,
    holes,
    missing: missingMintedTokenIds(knownAfter, lastMintedId),
    ...(error ? { error } : {}),
  };
}

type MintSpawnWriter = {
  charByTokenId(tokenId: string): { charId: string } | null;
  ensureMintedSpawn(
    tokenId: string,
    job: number,
    wallet?: string,
  ): { ok: true; created: boolean; charId: string } | { ok: false; error: string };
};

/** Append the spawn for a mint log. A token already on the journal is left as it is. */
export async function recordObservedMint(
  lok: MintSpawnWriter,
  xfer: { from: string; to: string; tokenId: string },
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  if (!isMintTransfer(xfer.from)) return;
  if (lok.charByTokenId(xfer.tokenId)) {
    pendingMints.delete(xfer.tokenId);
    return;
  }
  const genesis = await readCharacterGenesisJob(xfer.tokenId, env);
  if (!genesis.ok) {
    noteMintPending(xfer.tokenId, xfer.to);
    console.error("[bellgrave] mint #" + xfer.tokenId + " not recorded: " + genesis.error);
    return;
  }
  const spawned = lok.ensureMintedSpawn(xfer.tokenId, genesis.job, xfer.to);
  if (!spawned.ok) {
    noteMintPending(xfer.tokenId, xfer.to);
    console.error("[bellgrave] mint #" + xfer.tokenId + " was not written: " + spawned.error);
    return;
  }
  pendingMints.delete(xfer.tokenId);
  if (spawned.created) {
    console.log("[bellgrave] recorded mint #" + xfer.tokenId + " as " + spawned.charId + " job " + genesis.job);
  }
}

/**
 * Watch mints when the transfer watcher is not running.
 * A restart still backfills by token id, so this cursor only covers the live tail.
 */
export function startMintObserver(lok: MintSpawnWriter, opts?: { env?: NodeJS.ProcessEnv }): boolean {
  const env = opts?.env ?? process.env;
  const nft = env.LOK_NFT?.trim();
  if (!nft) return false;
  if (!(env.LOK_CHAIN_RPC?.trim() || env.LOK_CHAIN_RPC_URLS?.trim())) return false;
  const rpc = settlementRpc(env);
  let cursor = 0n;
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      const next = await scanNftTransfers({
        cursor,
        nft,
        startBlock: watcherStartBlock(env),
        confirmations: settlementConfirmations(env),
        preferFinalized: preferFinalizedTip(env),
        rpcCall: rpc.asCall(),
        onTransfer: async () => {},
        onMint: async (xfer) => {
          await recordObservedMint(lok, xfer, env);
        },
      });
      cursor = next.cursor;
    } catch (err) {
      console.error("[bellgrave] mint observer", err);
    } finally {
      busy = false;
    }
  };
  tick().catch((err) => console.error("[bellgrave] mint observer", err));
  const timer = setInterval(() => {
    tick().catch((err) => console.error("[bellgrave] mint observer", err));
  }, 5_000);
  timer.unref?.();
  console.log("[bellgrave] mint observer watching " + nft);
  return true;
}

/** Keep trying mints whose log or genesis job was not readable. A real hole is not queued. */
export function startMintCatchUp(
  lok: MintSpawnWriter,
  opts?: { env?: NodeJS.ProcessEnv; onMissingHistory?: (tokenId: string) => void },
): void {
  const env = opts?.env ?? process.env;
  let busy = false;
  const tick = async () => {
    if (busy || pendingMints.size === 0) return;
    busy = true;
    try {
      for (const [tokenId, to] of [...pendingMints]) {
        if (lok.charByTokenId(tokenId)) {
          pendingMints.delete(tokenId);
          continue;
        }
        if (to) {
          await recordObservedMint(lok, { from: ZERO_ADDRESS, to, tokenId }, env);
          continue;
        }
        const found = await findMintTransfer(tokenId, env);
        if (!found.complete) continue;
        const block = found.transfer?.blockNumber ? BigInt(found.transfer.blockNumber) : null;
        if (found.transfer && block != null && block <= found.scannedTo) {
          await recordObservedMint(lok, found.transfer, env);
          continue;
        }
        if (
          mintBecomesMissingHistory({
            inJournal: false,
            scanComplete: true,
            mintBlock: block,
            scannedTo: found.scannedTo,
            tip: found.tip,
          })
        ) {
          pendingMints.delete(tokenId);
          opts?.onMissingHistory?.(tokenId);
        }
      }
    } catch (err) {
      console.error("[bellgrave] mint catch-up", err);
    } finally {
      busy = false;
    }
  };
  const timer = setInterval(() => {
    tick().catch((err) => console.error("[bellgrave] mint catch-up", err));
  }, 15_000);
  timer.unref?.();
}

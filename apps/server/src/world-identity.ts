/**
 * A data directory is one world. The identity is the chain, the character
 * contract, and a genesis hash of those two. An empty directory is not the
 * first world unless this contract has no world yet.
 *
 * The hash is not on-chain yet. Until a published checkpoint records it,
 * `LOK_PUBLISHED_GENESIS` is that confirmation, and `nextTokenId > 1` only
 * means this contract has already issued characters. A different chain or
 * contract is a different world, so token ids do not collide across them.
 *
 * The one-writer file lock only covers processes on one host. Two machines
 * with two copies are still two worlds until a leader lease exists.
 */
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createPublicClient, http, keccak256, toBytes } from "viem";
import { isProductionSettlementChain } from "./production-boot";

export const WORLD_IDENTITY_FILE = "lok-world-id.json";

export const NO_WORLD_COPY =
  "This server has no copy of the world. It will not start a new one.";

export type WorldIdentity = {
  v: 1;
  chainId: number;
  nft: string;
  genesisHash: string;
};

export type WorldBoot = {
  ok: boolean;
  /** Shown at boot and returned to a logging-in player. */
  loginError: string;
  spawn: boolean;
  adopt: boolean;
  tick: boolean;
  writeIdentity: WorldIdentity | null;
  /** Existing journal had no header. Stamp it. Do not treat it as genesis. */
  stampLegacy: boolean;
};

export function worldGenesisHash(chainId: number, nft: string): string {
  const contract = nft.trim().toLowerCase();
  return keccak256(toBytes(`LOK_WORLD_ID_V1|${chainId}|${contract}`));
}

export function expectedWorldIdentity(chainId: number, nft: string): WorldIdentity {
  const contract = nft.trim().toLowerCase();
  return { v: 1, chainId, nft: contract, genesisHash: worldGenesisHash(chainId, contract) };
}

export function readWorldIdentity(dataDir: string): WorldIdentity | null {
  const path = join(dataDir, WORLD_IDENTITY_FILE);
  if (!existsSync(path)) return null;
  let parsed: Partial<WorldIdentity>;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<WorldIdentity>;
  } catch {
    return null;
  }
  if (parsed.v !== 1 || typeof parsed.chainId !== "number" || typeof parsed.nft !== "string") return null;
  if (typeof parsed.genesisHash !== "string" || !parsed.genesisHash.startsWith("0x")) return null;
  return {
    v: 1,
    chainId: parsed.chainId,
    nft: parsed.nft.toLowerCase(),
    genesisHash: parsed.genesisHash.toLowerCase(),
  };
}

export function writeWorldIdentity(dataDir: string, identity: WorldIdentity): void {
  writeFileSync(join(dataDir, WORLD_IDENTITY_FILE), JSON.stringify(identity, null, 2) + "\n");
}

/** True when this directory already has a journal or a bind. Unreadable bind counts. */
export function directoryHasJournal(dataDir: string): boolean {
  const journal = join(dataDir, "lok-world.jsonl");
  if (existsSync(journal)) {
    try {
      if (statSync(journal).size > 0) return true;
    } catch {
      return true;
    }
  }
  const bindPath = join(dataDir, "lok-bind.json");
  if (!existsSync(bindPath)) return false;
  try {
    const parsed = JSON.parse(readFileSync(bindPath, "utf8")) as { chars?: unknown };
    return Array.isArray(parsed.chars) && parsed.chars.length > 0;
  } catch {
    return true;
  }
}

function sameIdentity(a: WorldIdentity, b: WorldIdentity): boolean {
  return a.chainId === b.chainId && a.nft === b.nft && a.genesisHash === b.genesisHash;
}

/**
 * Empty directory + this contract already has a world: do not spawn, adopt, or tick.
 * A header for another chain or contract: do not run.
 */
export function assessWorldBoot(args: {
  onDisk: WorldIdentity | null;
  journalEmpty: boolean;
  chainId: number;
  nft: string;
  chainWorldExists: boolean;
}): WorldBoot {
  const expected = expectedWorldIdentity(args.chainId, args.nft);
  const refuse = (loginError: string): WorldBoot => ({
    ok: false,
    loginError,
    spawn: false,
    adopt: false,
    tick: false,
    writeIdentity: null,
    stampLegacy: false,
  });

  if (!Number.isSafeInteger(args.chainId) || args.chainId <= 0 || !/^0x[0-9a-f]{40}$/.test(expected.nft)) {
    return refuse("World identity is not configured (chain id and character contract are required).");
  }

  if (args.onDisk && !sameIdentity(args.onDisk, expected)) {
    return refuse(
      "This directory is world " +
        args.onDisk.genesisHash +
        " (chain " +
        args.onDisk.chainId +
        ", contract " +
        args.onDisk.nft +
        "). This process is chain " +
        expected.chainId +
        ", contract " +
        expected.nft +
        ". Refusing to run.",
    );
  }

  if (args.journalEmpty && args.chainWorldExists) {
    return refuse(NO_WORLD_COPY);
  }

  if (args.journalEmpty) {
    return {
      ok: true,
      loginError: "",
      spawn: true,
      adopt: true,
      tick: true,
      writeIdentity: expected,
      stampLegacy: false,
    };
  }

  return {
    ok: true,
    loginError: "",
    spawn: true,
    adopt: true,
    tick: true,
    writeIdentity: args.onDisk ? null : expected,
    stampLegacy: !args.onDisk,
  };
}

/**
 * Login must not invent a character. A token already in the journal or the
 * bind file is never spawned again. A server that is not caught up to the
 * world head adopts nothing. A brand-new token is created by the mint path.
 */
export function mayAdoptOwnedToken(args: {
  tokenId: string;
  journalTokenIds: ReadonlySet<string>;
  bindTokenIds: ReadonlySet<string>;
  caughtUp: boolean;
}): boolean {
  if (!args.caughtUp) return false;
  if (args.journalTokenIds.has(args.tokenId) || args.bindTokenIds.has(args.tokenId)) return false;
  // A caught-up server still does not invent a character at login.
  // The mint path is what writes the first spawn for a new token.
  return false;
}

/**
 * `CharacterNFT.nextTokenId` is the last minted id (0 when none exist).
 * Every id from 1 through that value must already be in this journal.
 */
export function journalCoversIssuedTokens(known: ReadonlySet<string>, lastMintedId: bigint): boolean {
  if (lastMintedId < 1n) return true;
  for (let id = 1n; id <= lastMintedId; id++) {
    if (!known.has(id.toString())) return false;
  }
  return true;
}

const NEXT_TOKEN_ABI = [
  { type: "function", name: "nextTokenId", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

export type ChainWorldSignal = { exists: boolean; nextTokenId: bigint; reason: string };

/**
 * A published genesis hash means a world for this contract was announced.
 * `nextTokenId > 1` means characters were already issued. A production RPC
 * failure is treated as "a world may exist" so an empty directory cannot
 * become genesis by accident.
 */
export async function contractWorldExists(env: NodeJS.ProcessEnv): Promise<ChainWorldSignal> {
  const published = env.LOK_PUBLISHED_GENESIS?.trim();
  const nft = env.LOK_NFT?.trim();
  const rpc = env.LOK_CHAIN_RPC?.trim() || env.LOK_PUBLIC_RPC?.trim() || "";
  if (!nft || !rpc) {
    if (published) return { exists: true, nextTokenId: 0n, reason: "published genesis is set" };
    return { exists: false, nextTokenId: 0n, reason: "no character contract rpc" };
  }
  try {
    const chainId = Number(env.LOK_CHAIN_ID ?? "0");
    const pub = createPublicClient({
      chain: {
        id: Number.isSafeInteger(chainId) && chainId > 0 ? chainId : 1,
        name: "settlement",
        nativeCurrency: { name: "xDAI", symbol: "xDAI", decimals: 18 },
        rpcUrls: { default: { http: [rpc] } },
      },
      transport: http(rpc),
    });
    const next = await pub.readContract({
      address: nft as `0x${string}`,
      abi: NEXT_TOKEN_ABI,
      functionName: "nextTokenId",
    });
    const issued = typeof next === "bigint" ? next : BigInt(next);
    if (published) {
      return { exists: true, nextTokenId: issued, reason: "published genesis is set; nextTokenId=" + issued.toString() };
    }
    if (issued >= 1n) return { exists: true, nextTokenId: issued, reason: "nextTokenId=" + issued.toString() };
    return { exists: false, nextTokenId: issued, reason: "nextTokenId=" + issued.toString() };
  } catch (err) {
    const why = err instanceof Error ? err.message : String(err);
    if (isProductionSettlementChain(env)) {
      return {
        exists: true,
        nextTokenId: 0n,
        reason: "could not read the character contract (" + why + "); refusing to invent a world",
      };
    }
    return { exists: false, nextTokenId: 0n, reason: "local chain unread (" + why + ")" };
  }
}

/**
 * The manifest is the world's published head. This process reads it.
 * The Admin Safe is the rotator until bonded replicas can vote, and until
 * that vote exists the Safe is the trust root.
 *
 * Clients treat play between checkpoints as provisional. A leader that misses
 * two intervals is stale. Rotation on that timeout is the Safe's act.
 */
import { createPublicClient, http, keccak256, type Hex } from "viem";
import { cpSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import type { PublishedLease } from "./capability";

/** Ten minutes. Two missed intervals is the stale-leader window. */
export const CHECKPOINT_INTERVAL_SEC = 600;

export const MANIFEST_ABI = [
  {
    type: "function",
    name: "genesisSet",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "worldGenesis",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "head",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "merkleRoot",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "rulesetHash",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "epoch",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint64" }],
  },
  {
    type: "function",
    name: "leader",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "journalUri",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "journalHash",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "headEntries",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint64" }],
  },
  {
    type: "function",
    name: "leaderStale",
    stateMutability: "view",
    inputs: [{ name: "nowTs", type: "uint64" }],
    outputs: [{ type: "bool" }],
  },
] as const;

export type ManifestView = PublishedLease & {
  genesisSet: boolean;
  worldGenesis: Hex;
  head: Hex;
  merkleRoot: Hex;
  rulesetHash: Hex;
  journalUri: string;
  journalHash: Hex;
  headEntries: bigint;
  leaderStale: boolean;
};

export async function readWorldManifest(
  env: NodeJS.ProcessEnv = process.env,
): Promise<ManifestView | null> {
  const address = env.LOK_MANIFEST?.trim();
  const rpc = env.LOK_CHAIN_RPC?.trim() || env.LOK_PUBLIC_RPC?.trim();
  if (!address || !rpc || !/^0x[0-9a-fA-F]{40}$/.test(address)) return null;
  try {
    const client = createPublicClient({ transport: http(rpc) });
    const contract = { address: address as Hex, abi: MANIFEST_ABI };
    const genesisSet = await client.readContract({ ...contract, functionName: "genesisSet" });
    if (!genesisSet) return null;
    const [worldGenesis, head, merkleRoot, rulesetHash, epoch, leader, journalUri, journalHash, headEntries, leaderStale] =
      await Promise.all([
        client.readContract({ ...contract, functionName: "worldGenesis" }),
        client.readContract({ ...contract, functionName: "head" }),
        client.readContract({ ...contract, functionName: "merkleRoot" }),
        client.readContract({ ...contract, functionName: "rulesetHash" }),
        client.readContract({ ...contract, functionName: "epoch" }),
        client.readContract({ ...contract, functionName: "leader" }),
        client.readContract({ ...contract, functionName: "journalUri" }),
        client.readContract({ ...contract, functionName: "journalHash" }),
        client.readContract({ ...contract, functionName: "headEntries" }),
        client.readContract({
          ...contract,
          functionName: "leaderStale",
          args: [BigInt(Math.floor(Date.now() / 1000))],
        }),
      ]);
    return {
      genesisSet: true,
      worldGenesis,
      head,
      merkleRoot,
      rulesetHash,
      epoch,
      leader,
      journalUri,
      journalHash,
      headEntries,
      leaderStale,
    };
  } catch (err) {
    console.error("[bellgrave] manifest unread: " + (err instanceof Error ? err.message : String(err)));
    return null;
  }
}

/** Copy a published journal into dest when the bytes hash to journalHash. file: URIs only rewrite local disk. */
export function fetchPublishedJournal(args: {
  uri: string;
  journalHash: Hex;
  destJournal: string;
}): { ok: true } | { ok: false; error: string } {
  let source = args.uri.trim();
  if (source.startsWith("file:")) source = source.slice("file:".length).replace(/^\/+([A-Za-z]:)/, "$1");
  if (!source || !existsSync(source)) return { ok: false, error: "Published journal is not on this machine." };
  const bytes = readFileSync(source);
  const hash = keccak256(bytes);
  if (hash.toLowerCase() !== args.journalHash.toLowerCase()) {
    return { ok: false, error: "Published journal hash does not match the manifest." };
  }
  mkdirSync(dirname(args.destJournal), { recursive: true });
  cpSync(source, args.destJournal);
  return { ok: true };
}

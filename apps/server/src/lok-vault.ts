/**
 * Local ruleset propose + character NFT link. Writes go through viem on the
 * shared owner-key queue (no private key on the cast argv).
 */
import { createPublicClient, createWalletClient, http, type Chain, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { renameSync, writeFileSync } from "node:fs";
import { withOwnerKeyQueue } from "./owner-tx-queue";

/** Accepted on the local anvil only. Not a mainnet ruleset. Bumped with ChainFill payment refs. */
export const LOCAL_RULESET_HASH = "0xb7e4d1c9a8f6520e3d7c6b5a49382716f0e1d2c3b4a5968778695a4b3c2d1e0f";

/**
 * sha256 of the checked-in engine bundle (contracts/lok-log/engine/pkg/lok_engine.wasm) that
 * checkpoints signed under LOCAL_RULESET_HASH are computed with. LOCAL_RULESET_HASH is an opaque id
 * registered on the local anvil; it is not derived from the wasm, so this pin is the binding.
 * lok-ruleset-pin.test.ts fails when the checked-in wasm drifts from it. When the engine changes on
 * purpose: rebuild the wasm, run contracts/lok-log/engine/scripts/check-wasm-pin.mjs, update this pin,
 * and on any non-local network propose a new ruleset hash for the new bundle.
 */
export const LOCAL_RULESET_WASM_SHA256 = "5d54853ebfc6a17eb3306045749c4b92e2ac8540b645f4a911ddc42e65e9377b";

export const LOCAL_ANVIL_CHAIN_ID = 31337n;

export type VaultErr = { ok: false; error: string; uncertain?: boolean; id?: string; needsPlayerMint?: boolean };

export type CharacterMintClientConfig = {
  factory: string;
  nft: string;
  mintFee: string;
  chainId: number;
  rpcUrl: string;
};

type Env = {
  rpc: string;
  nft: string;
  factory: string;
  rulesets: string;
  ownerKey: string;
  proposerKey: string;
};

function envOf(env: NodeJS.ProcessEnv): Env {
  const pick = (key: string) => env[key]?.trim() ?? "";
  return {
    rpc: pick("LOK_CHAIN_RPC"),
    nft: pick("LOK_NFT"),
    factory: pick("LOK_FACTORY"),
    rulesets: pick("LOK_RULESETS"),
    ownerKey: pick("LOK_OWNER_KEY"),
    proposerKey: pick("LOK_PROPOSER_KEY"),
  };
}

function redact(text: string, secrets: string[]): string {
  let out = text;
  for (const secret of secrets) {
    if (secret.length >= 8) out = out.split(secret).join("[redacted]");
  }
  return out.replace(/\s+/g, " ").trim().slice(0, 280);
}

export function writeTextAtomic(path: string, text: string): void {
  const tmp = path + ".tmp";
  writeFileSync(tmp, text);
  renameSync(tmp, path);
}

function isAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}

function chainOf(chainId: number, rpcUrl: string): Chain {
  return {
    id: chainId,
    name: chainId === 31337 ? "Bellgrave Anvil" : "Bellgrave",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  };
}

const NFT_ABI = [
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "nextTokenId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "transferFrom",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

const FACTORY_ABI = [
  {
    type: "function",
    name: "mintFee",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;

const RULESETS_ABI = [
  {
    type: "function",
    name: "isAccepted",
    stateMutability: "view",
    inputs: [{ name: "hash", type: "bytes32" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "minDelay",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint64" }],
  },
  {
    type: "function",
    name: "propose",
    stateMutability: "nonpayable",
    inputs: [
      { name: "hash", type: "bytes32" },
      { name: "delay", type: "uint64" },
      { name: "uri", type: "string" },
    ],
    outputs: [],
  },
] as const;

function publicClient(rpc: string, chainId: number) {
  return createPublicClient({
    chain: chainOf(chainId, rpc),
    transport: http(rpc),
  });
}

async function chainIdOf(rpc: string): Promise<number> {
  const pub = createPublicClient({ transport: http(rpc) });
  return Number(await pub.getChainId());
}

/** Browser-reachable mint config so the player can pay createCharacter{value}. */
export async function characterMintClientConfig(
  envIn: NodeJS.ProcessEnv = process.env,
): Promise<CharacterMintClientConfig | null> {
  const env = envOf(envIn);
  const publicRpc = envIn.LOK_PUBLIC_RPC?.trim() || env.rpc;
  if (!env.rpc || !env.factory || !env.nft || !publicRpc) return null;
  if (!publicRpc.startsWith("http://") && !publicRpc.startsWith("https://")) return null;
  try {
    const chainId = await chainIdOf(env.rpc);
    if (BigInt(chainId) !== LOCAL_ANVIL_CHAIN_ID) return null;
    const pub = publicClient(env.rpc, chainId);
    const fee = await pub.readContract({
      address: env.factory as `0x${string}`,
      abi: FACTORY_ABI,
      functionName: "mintFee",
    });
    return {
      factory: env.factory,
      nft: env.nft,
      mintFee: fee.toString(),
      chainId,
      rpcUrl: publicRpc,
    };
  } catch {
    return null;
  }
}

/**
 * Link a log token to an on-chain NFT the **player** already minted (or move one
 * the owner still holds). Does not pay mintFee from the server key.
 */
export async function linkCharacterNft(
  tokenId: string,
  job: number,
  playerWallet?: string,
  envIn: NodeJS.ProcessEnv = process.env,
): Promise<{ ok: true; tokenId: string } | VaultErr> {
  const env = envOf(envIn);
  if (!env.rpc || !env.factory || !env.nft) {
    return { ok: false, error: "Character mint is not configured. The log identity was still created." };
  }
  if (!Number.isInteger(job) || job < 0 || job > 255) return { ok: false, error: "That job cannot be minted." };
  const player = playerWallet && isAddress(playerWallet) ? playerWallet.toLowerCase() : "";
  try {
    const chainId = await chainIdOf(env.rpc);
    if (BigInt(chainId) !== LOCAL_ANVIL_CHAIN_ID) {
      return { ok: false, error: "Character NFT link is only checked on local chain 31337." };
    }
    const pub = publicClient(env.rpc, chainId);
    const nft = env.nft as `0x${string}`;

    let held: string;
    try {
      held = (
        await pub.readContract({
          address: nft,
          abi: NFT_ABI,
          functionName: "ownerOf",
          args: [BigInt(tokenId)],
        })
      ).toLowerCase();
    } catch {
      const next = await pub.readContract({
        address: nft,
        abi: NFT_ABI,
        functionName: "nextTokenId",
      });
      if (next + 1n !== BigInt(tokenId)) {
        return {
          ok: false,
          error: "Refused to expect NFT " + tokenId + " because the checkpoint next id is " + String(next + 1n) + ".",
        };
      }
      return {
        ok: false,
        needsPlayerMint: true,
        error:
          "Pay the character mint fee from your wallet (createCharacter). NFT #" +
          tokenId +
          " is not on-chain yet.",
      };
    }

    const dest = player || held;
    if (held === dest) return { ok: true, tokenId };

    if (!env.ownerKey) {
      return {
        ok: false,
        error: "NFT #" + tokenId + " is held by " + held + " and cannot be moved without the owner key.",
      };
    }
    const account = privateKeyToAccount(env.ownerKey as Hex);
    if (held !== account.address.toLowerCase()) {
      return {
        ok: false,
        error: "NFT " + tokenId + " is already minted to someone else. No second mint was sent.",
      };
    }

    return withOwnerKeyQueue(async () => {
      const wallet = createWalletClient({
        account,
        chain: chainOf(chainId, env.rpc),
        transport: http(env.rpc),
      });
      const hash = await wallet.writeContract({
        address: nft,
        abi: NFT_ABI,
        functionName: "transferFrom",
        args: [account.address, dest as `0x${string}`, BigInt(tokenId)],
        account,
        chain: chainOf(chainId, env.rpc),
      });
      const receipt = await pub.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        return { ok: false, error: "Character NFT transfer reverted." };
      }
      return { ok: true, tokenId };
    });
  } catch (err) {
    return { ok: false, error: "Character NFT was not linked. " + redact(String(err), [env.ownerKey]) };
  }
}

export async function ensureLocalRuleset(envIn: NodeJS.ProcessEnv = process.env): Promise<void> {
  const env = envOf(envIn);
  if (!env.rpc || !env.rulesets || !env.proposerKey) return;
  try {
    const chainId = await chainIdOf(env.rpc);
    const pub = publicClient(env.rpc, chainId);
    const rulesets = env.rulesets as `0x${string}`;
    const accepted = await pub.readContract({
      address: rulesets,
      abi: RULESETS_ABI,
      functionName: "isAccepted",
      args: [LOCAL_RULESET_HASH as Hex],
    });
    if (accepted) return;
    const delay = await pub.readContract({
      address: rulesets,
      abi: RULESETS_ABI,
      functionName: "minDelay",
    });
    await withOwnerKeyQueue(async () => {
      const account = privateKeyToAccount(env.proposerKey as Hex);
      const wallet = createWalletClient({
        account,
        chain: chainOf(chainId, env.rpc),
        transport: http(env.rpc),
      });
      const hash = await wallet.writeContract({
        address: rulesets,
        abi: RULESETS_ABI,
        functionName: "propose",
        args: [LOCAL_RULESET_HASH as Hex, delay, "local"],
        account,
        chain: chainOf(chainId, env.rpc),
      });
      await pub.waitForTransactionReceipt({ hash });
    });
    console.log("[bellgrave] proposed local ruleset. It is not accepted until the registry delay elapses.");
  } catch (err) {
    console.error("[bellgrave] ruleset setup failed: " + redact(String(err), [env.proposerKey, env.ownerKey]));
  }
}

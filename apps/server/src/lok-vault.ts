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
export const LOCAL_RULESET_WASM_SHA256 = "bbf77ab29b31bc869891028d83ab1ee85f4d84a9137f8631d05c4c0876496510";

export const LOCAL_ANVIL_CHAIN_ID = 31337n;

export type VaultErr = { ok: false; error: string; uncertain?: boolean; id?: string; needsPlayerMint?: boolean };

export type CharacterMintClientConfig = {
  factory: string;
  nft: string;
  mintFee: string;
  chainId: number;
  rpcUrl: string;
  supportsCreateFor: boolean;
  suggestedTokenId: string;
  devFaucet: boolean;
  devServerMint: boolean;
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
  {
    type: "function",
    name: "createCharacterFor",
    stateMutability: "payable",
    inputs: [
      { name: "startingJob", type: "uint8" },
      { name: "expectedTokenId", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "createCharacter",
    stateMutability: "payable",
    inputs: [{ name: "startingJob", type: "uint8" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

/** Local 31337 faucet: on by default when owner key is set; set LOK_DEV_FAUCET=0 to disable. */
export function devFaucetEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.LOK_DEV_FAUCET === "0") return false;
  if (env.LOK_DEV_FAUCET === "1" || env.NODE_ENV === "development" || env.ALLOW_DEBUG_CHEATS === "1") {
    return true;
  }
  return !!(env.LOK_OWNER_KEY?.trim() && (env.LOK_CHAIN_RPC?.trim() || env.LOK_FACTORY?.trim()));
}

export function devServerMintEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.LOK_DEV_SERVER_MINT === "1";
}

export async function factorySupportsCreateFor(
  rpc: string,
  factory: string,
  chainId: number,
): Promise<boolean> {
  const pub = publicClient(rpc, chainId);
  try {
    await pub.simulateContract({
      address: factory as `0x${string}`,
      abi: FACTORY_ABI,
      functionName: "createCharacterFor",
      args: [0, 1n],
      value: 0n,
      account: "0x0000000000000000000000000000000000000001",
    });
    return true;
  } catch (err) {
    const msg = String(err);
    if (/WrongFee|WrongTokenId|BadJob|0x[0-9a-fA-F]{8}/i.test(msg)) return true;
    if (/Function "createCharacterFor" not found|does not exist|returned no data|execution reverted/i.test(msg)) {
      // "execution reverted" alone can mean the fn exists; prefer selector miss phrases.
      if (/not found|does not exist|no data|abi/i.test(msg) && !/WrongFee|WrongTokenId|BadJob/i.test(msg)) {
        return false;
      }
    }
    // Most reverts from an existing function still prove the selector is present.
    if (/reverted|WrongFee|WrongTokenId/i.test(msg)) return true;
    return false;
  }
}

/** AlreadyProposed() — pending proposal is fine; do not log as failure. */
const ALREADY_PROPOSED_SELECTOR = "0x79429186";

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
  {
    type: "function",
    name: "rulesets",
    stateMutability: "view",
    inputs: [{ name: "hash", type: "bytes32" }],
    outputs: [
      { name: "activatesAt", type: "uint64" },
      { name: "retiresAt", type: "uint64" },
      { name: "cancelled", type: "bool" },
      { name: "uri", type: "string" },
    ],
  },
  { type: "error", name: "AlreadyProposed", inputs: [] },
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
  opts?: { logNextTokenId?: string },
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
    const next = await pub.readContract({
      address: env.nft as `0x${string}`,
      abi: NFT_ABI,
      functionName: "nextTokenId",
    });
    const chainSuggested = next + 1n;
    let suggested = chainSuggested;
    const logNext = opts?.logNextTokenId?.trim();
    if (logNext && /^[1-9][0-9]{0,77}$/.test(logNext)) {
      const logN = BigInt(logNext);
      if (logN > suggested) suggested = logN;
    }
    const supportsCreateFor = await factorySupportsCreateFor(env.rpc, env.factory, chainId);
    return {
      factory: env.factory,
      nft: env.nft,
      mintFee: fee.toString(),
      chainId,
      rpcUrl: publicRpc,
      supportsCreateFor,
      suggestedTokenId: suggested.toString(),
      devFaucet: devFaucetEnabled(envIn),
      devServerMint: devServerMintEnabled(envIn),
    };
  } catch {
    return null;
  }
}

/**
 * Link a log token to an on-chain NFT the **player** already minted (or move one
 * the owner still holds). Does not pay mintFee from the server key.
 *
 * `acceptedWallets` may include the burner auth address and/or the EIP-1193
 * wallet that paid `createCharacterFor` — either holder counts as linked.
 */
export async function linkCharacterNft(
  tokenId: string,
  job: number,
  playerWallet?: string,
  envIn: NodeJS.ProcessEnv = process.env,
  opts?: { acceptedWallets?: string[] },
): Promise<{ ok: true; tokenId: string; holder?: string } | VaultErr> {
  const env = envOf(envIn);
  if (!env.rpc || !env.factory || !env.nft) {
    return { ok: false, error: "Character mint is not configured. The log identity was still created." };
  }
  if (!Number.isInteger(job) || job < 0 || job > 255) return { ok: false, error: "That job cannot be minted." };
  const accepted = new Set<string>();
  if (playerWallet && isAddress(playerWallet)) accepted.add(playerWallet.toLowerCase());
  for (const w of opts?.acceptedWallets ?? []) {
    if (isAddress(w)) accepted.add(w.toLowerCase());
  }
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
          error:
            "Refused to expect NFT " +
            tokenId +
            " because the chain next id is " +
            String(next + 1n) +
            ". Mint with createCharacterFor(job, " +
            tokenId +
            ").",
        };
      }
      return {
        ok: false,
        needsPlayerMint: true,
        error:
          "Pay the character mint fee from your wallet (createCharacterFor). NFT #" +
          tokenId +
          " is not on-chain yet.",
      };
    }

    if (accepted.size === 0 || accepted.has(held)) {
      return { ok: true, tokenId, holder: held };
    }

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

    const dest = [...accepted][0]!;
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
      return { ok: true, tokenId, holder: dest };
    });
  } catch (err) {
    return { ok: false, error: "Character NFT was not linked. " + redact(String(err), [env.ownerKey]) };
  }
}

/** Poll ownerOf until the player mint confirms, then link. */
export async function linkCharacterNftWithRetry(
  tokenId: string,
  job: number,
  playerWallet: string | undefined,
  opts?: {
    env?: NodeJS.ProcessEnv;
    acceptedWallets?: string[];
    attempts?: number;
    delayMs?: number;
  },
): Promise<{ ok: true; tokenId: string; holder?: string } | VaultErr> {
  const attempts = opts?.attempts ?? 12;
  const delayMs = opts?.delayMs ?? 1500;
  let last: { ok: true; tokenId: string; holder?: string } | VaultErr = {
    ok: false,
    needsPlayerMint: true,
    error: "Mint not confirmed yet.",
  };
  for (let i = 0; i < attempts; i++) {
    last = await linkCharacterNft(tokenId, job, playerWallet, opts?.env, {
      acceptedWallets: opts?.acceptedWallets,
    });
    if (last.ok || !last.needsPlayerMint) return last;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return last;
}

const faucetLastAt = new Map<string, number>();
const FAUCET_COOLDOWN_MS = 60_000;

/**
 * Dev-only native ETH faucet for burners on chain 31337.
 * Default-on when LOK_OWNER_KEY is set (set LOK_DEV_FAUCET=0 to disable).
 * Rate-limited per destination; caller must pass their own verified wallet.
 */
export async function faucetAnvilEth(
  to: string,
  envIn: NodeJS.ProcessEnv = process.env,
  opts?: { callerWallet?: string },
): Promise<{ ok: true; hash: Hex; amountWei: string } | VaultErr> {
  const env = envOf(envIn);
  if (!devFaucetEnabled(envIn)) return { ok: false, error: "Dev faucet is disabled." };
  if (!env.rpc || !env.ownerKey) return { ok: false, error: "Faucet needs LOK_CHAIN_RPC and LOK_OWNER_KEY." };
  if (!isAddress(to)) return { ok: false, error: "Bad faucet destination." };
  const dest = to.toLowerCase();
  if (opts?.callerWallet) {
    if (!isAddress(opts.callerWallet) || opts.callerWallet.toLowerCase() !== dest) {
      return { ok: false, error: "Faucet can only fund your own verified wallet." };
    }
  }
  const last = faucetLastAt.get(dest) ?? 0;
  if (Date.now() - last < FAUCET_COOLDOWN_MS) {
    return { ok: false, error: "Faucet rate limit: wait before requesting again." };
  }
  try {
    const chainId = await chainIdOf(env.rpc);
    if (BigInt(chainId) !== LOCAL_ANVIL_CHAIN_ID) {
      return { ok: false, error: "Faucet is only available on local chain 31337." };
    }
    const amount = 100_000_000_000_000_000n; // 0.1 ETH — enough for many mint fees
    return withOwnerKeyQueue(async () => {
      const account = privateKeyToAccount(env.ownerKey as Hex);
      const pub = publicClient(env.rpc, chainId);
      const wallet = createWalletClient({
        account,
        chain: chainOf(chainId, env.rpc),
        transport: http(env.rpc),
      });
      const hash = await wallet.sendTransaction({
        account,
        chain: chainOf(chainId, env.rpc),
        to: dest as `0x${string}`,
        value: amount,
      });
      const receipt = await pub.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") return { ok: false, error: "Faucet transfer reverted." };
      faucetLastAt.set(dest, Date.now());
      return { ok: true, hash, amountWei: amount.toString() };
    });
  } catch (err) {
    return { ok: false, error: "Faucet failed. " + redact(String(err), [env.ownerKey]) };
  }
}

/**
 * Dev-only: server pays createCharacterFor so local testing still mints when
 * burners have no ETH. Requires LOK_DEV_SERVER_MINT=1 and chain 31337.
 */
export async function serverMintCharacterFor(
  tokenId: string,
  job: number,
  toWallet: string,
  envIn: NodeJS.ProcessEnv = process.env,
): Promise<{ ok: true; tokenId: string; hash: Hex } | VaultErr> {
  const env = envOf(envIn);
  if (envIn.LOK_DEV_SERVER_MINT !== "1") {
    return { ok: false, error: "Server-paid mint is disabled (set LOK_DEV_SERVER_MINT=1 for local)." };
  }
  if (!env.rpc || !env.factory || !env.ownerKey) {
    return { ok: false, error: "Server mint needs factory + owner key." };
  }
  if (!isAddress(toWallet)) return { ok: false, error: "Bad mint destination." };
  if (!Number.isInteger(job) || job < 0 || job > 255) return { ok: false, error: "That job cannot be minted." };
  try {
    const chainId = await chainIdOf(env.rpc);
    if (BigInt(chainId) !== LOCAL_ANVIL_CHAIN_ID) {
      return { ok: false, error: "Server mint is only available on local chain 31337." };
    }
    const pub = publicClient(env.rpc, chainId);
    const fee = await pub.readContract({
      address: env.factory as `0x${string}`,
      abi: FACTORY_ABI,
      functionName: "mintFee",
    });
    return withOwnerKeyQueue(async () => {
      const account = privateKeyToAccount(env.ownerKey as Hex);
      const wallet = createWalletClient({
        account,
        chain: chainOf(chainId, env.rpc),
        transport: http(env.rpc),
      });
      // Mint to the player via createCharacterFor, then transfer if needed.
      // Factory mints to msg.sender (owner), then we transfer to the player.
      const hash = await wallet.writeContract({
        address: env.factory as `0x${string}`,
        abi: FACTORY_ABI,
        functionName: "createCharacterFor",
        args: [job, BigInt(tokenId)],
        value: fee,
        account,
        chain: chainOf(chainId, env.rpc),
      });
      const receipt = await pub.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") return { ok: false, error: "Server createCharacterFor reverted." };
      const held = (
        await pub.readContract({
          address: env.nft as `0x${string}`,
          abi: NFT_ABI,
          functionName: "ownerOf",
          args: [BigInt(tokenId)],
        })
      ).toLowerCase();
      if (held !== toWallet.toLowerCase()) {
        const xfer = await wallet.writeContract({
          address: env.nft as `0x${string}`,
          abi: NFT_ABI,
          functionName: "transferFrom",
          args: [account.address, toWallet as `0x${string}`, BigInt(tokenId)],
          account,
          chain: chainOf(chainId, env.rpc),
        });
        const xReceipt = await pub.waitForTransactionReceipt({ hash: xfer });
        if (xReceipt.status !== "success") return { ok: false, error: "Server NFT transfer reverted." };
      }
      return { ok: true, tokenId, hash };
    });
  } catch (err) {
    return { ok: false, error: "Server mint failed. " + redact(String(err), [env.ownerKey]) };
  }
}

/** Verify the player already owns tokenId on-chain (mint-first create). */
export async function verifyCharacterNftOwner(
  tokenId: string,
  wallets: string[],
  envIn: NodeJS.ProcessEnv = process.env,
): Promise<{ ok: true; holder: string } | VaultErr> {
  const env = envOf(envIn);
  if (!env.rpc || !env.nft) return { ok: false, error: "Character NFT is not configured." };
  const accepted = new Set(wallets.filter(isAddress).map((w) => w.toLowerCase()));
  if (accepted.size === 0) return { ok: false, error: "No wallet to verify against." };
  try {
    const chainId = await chainIdOf(env.rpc);
    const pub = publicClient(env.rpc, chainId);
    const holder = (
      await pub.readContract({
        address: env.nft as `0x${string}`,
        abi: NFT_ABI,
        functionName: "ownerOf",
        args: [BigInt(tokenId)],
      })
    ).toLowerCase();
    if (!accepted.has(holder)) {
      return { ok: false, error: "NFT #" + tokenId + " is held by " + holder + ", not your wallet." };
    }
    return { ok: true, holder };
  } catch (err) {
    return {
      ok: false,
      needsPlayerMint: true,
      error: "NFT #" + tokenId + " is not on-chain yet. " + redact(String(err), []),
    };
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
    // Pending proposal is OK — don't propose again / don't log failure.
    try {
      const row = await pub.readContract({
        address: rulesets,
        abi: RULESETS_ABI,
        functionName: "rulesets",
        args: [LOCAL_RULESET_HASH as Hex],
      });
      if (row[0] !== 0n) {
        console.log("[bellgrave] local ruleset already proposed (activatesAt=" + String(row[0]) + ").");
        return;
      }
    } catch {
      /* older ABI without rulesets() — fall through to propose */
    }
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
    const msg = String(err);
    if (
      msg.toLowerCase().includes(ALREADY_PROPOSED_SELECTOR) ||
      /AlreadyProposed/i.test(msg)
    ) {
      console.log("[bellgrave] local ruleset already proposed (AlreadyProposed).");
      return;
    }
    console.error("[bellgrave] ruleset setup failed: " + redact(msg, [env.proposerKey, env.ownerKey]));
  }
}

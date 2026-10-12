/**
 * Serialized AhEscrow txs via viem (no private key on the cast argv).
 * Shares the owner-key queue with lok-vault so listing + mint never nonce-collide.
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  type Chain,
  type Hex,
  type TransactionReceipt,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ahEscrowAddress, ahEscrowClientConfig, listingRoleKey } from "./ah-escrow";
import { openAskPendingStore } from "./open-ask-pending";
import { withOwnerKeyQueue } from "./owner-tx-queue";
import { settlementConfirmations } from "./settlement-confirmations";

const AH_ABI = [
  {
    type: "function",
    name: "openAsk",
    stateMutability: "nonpayable",
    inputs: [
      { name: "listingId", type: "uint256" },
      { name: "sellerTokenId", type: "uint256" },
      { name: "itemId", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "priceWei", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "cancelAsk",
    stateMutability: "nonpayable",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "asks",
    stateMutability: "view",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: [
      { name: "sellerTokenId", type: "uint256" },
      { name: "itemId", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "priceWei", type: "uint256" },
      { name: "open", type: "bool" },
      { name: "used", type: "bool" },
    ],
  },
  { type: "error", name: "AskClosed", inputs: [] },
  { type: "error", name: "AskExists", inputs: [] },
  { type: "error", name: "BadAmount", inputs: [] },
  { type: "error", name: "BadAddress", inputs: [] },
  { type: "error", name: "BadId", inputs: [] },
  { type: "error", name: "WrongPrice", inputs: [] },
  { type: "error", name: "Unauthorized", inputs: [] },
  { type: "error", name: "TransferFailed", inputs: [] },
  { type: "error", name: "Reentrant", inputs: [] },
] as const;

/** AskClosed() selector — kept as a fallback if a client strips error names. */
const ASK_CLOSED_SELECTOR = "0x756918b7";

export type OnchainAsk = {
  sellerTokenId: string;
  itemId: string;
  amount: string;
  priceWei: string;
  open: boolean;
  used: boolean;
};

function chainOf(chainId: number, rpcUrl: string): Chain {
  return {
    id: chainId,
    name: chainId === 31337 ? "Bellgrave Anvil" : "Bellgrave",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  };
}

/** Read-only public client — no LOK_LISTING_KEY required (boot reconcile / asks()). */
function readClient(env: NodeJS.ProcessEnv = process.env) {
  const cfg = ahEscrowClientConfig(env);
  const escrow = ahEscrowAddress(env);
  if (!cfg || !escrow) {
    return { ok: false as const, error: "AhEscrow is not configured." };
  }
  const chain = chainOf(cfg.chainId, cfg.rpcUrl);
  const pub = createPublicClient({
    chain,
    transport: http(cfg.rpcUrl),
  });
  return { ok: true as const, pub, chain, escrow: escrow as `0x${string}`, cfg };
}

function client(env: NodeJS.ProcessEnv = process.env) {
  const base = readClient(env);
  if (!base.ok) return base;
  const key = listingRoleKey(env);
  if (!key) {
    return { ok: false as const, error: "AhEscrow listing signer is not configured." };
  }
  const account = privateKeyToAccount(key as Hex);
  const transport = http(base.cfg.rpcUrl);
  const wallet = createWalletClient({
    account,
    chain: base.chain,
    transport,
  });
  return {
    ok: true as const,
    wallet,
    pub: base.pub,
    account,
    chain: base.chain,
    escrow: base.escrow,
    cfg: base.cfg,
  };
}

async function waitReceipt(
  pub: ReturnType<typeof createPublicClient>,
  hash: Hex,
  confirmations = 1,
): Promise<TransactionReceipt> {
  return pub.waitForTransactionReceipt({
    hash,
    confirmations: confirmations >= 1 ? confirmations : 1,
  });
}

/** M-2: log escrow release waits for settlement depth (finalized tip / N blocks). */
function cancelConfirmations(env?: NodeJS.ProcessEnv): number {
  const n = Number(settlementConfirmations(env));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export async function readAskOnchain(opts: {
  listingId: string;
  env?: NodeJS.ProcessEnv;
}): Promise<{ ok: true; ask: OnchainAsk } | { ok: false; error: string }> {
  const c = readClient(opts.env);
  if (!c.ok) return c;
  try {
    const row = await c.pub.readContract({
      address: c.escrow,
      abi: AH_ABI,
      functionName: "asks",
      args: [BigInt(opts.listingId)],
    });
    return {
      ok: true,
      ask: {
        sellerTokenId: row[0].toString(),
        itemId: row[1].toString(),
        amount: row[2].toString(),
        priceWei: row[3].toString(),
        open: row[4],
        used: row[5],
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function isAskClosedError(msg: string): boolean {
  return /AskClosed|ask closed/i.test(msg) || msg.toLowerCase().includes(ASK_CLOSED_SELECTOR);
}

export async function openAskOnchain(opts: {
  listingId: string;
  sellerTokenId: string;
  itemId: string;
  amount: string;
  priceWei: string;
  env?: NodeJS.ProcessEnv;
  dataDir?: string;
}): Promise<{ ok: true; hash: Hex } | { ok: false; error: string; chainOpen?: boolean }> {
  return withOwnerKeyQueue(async () => {
    const c = client(opts.env);
    if (!c.ok) return c;
    let hash: Hex | undefined;
    try {
      const nonce = await c.pub.getTransactionCount({
        address: c.account.address,
        blockTag: "pending",
      });
      hash = await c.wallet.writeContract({
        address: c.escrow,
        abi: AH_ABI,
        functionName: "openAsk",
        args: [
          BigInt(opts.listingId),
          BigInt(opts.sellerTokenId),
          BigInt(opts.itemId),
          BigInt(opts.amount),
          BigInt(opts.priceWei),
        ],
        account: c.account,
        chain: c.chain,
        nonce,
      });
      // M-1: record broadcast before waiting so a stuck receipt cannot be reclaimed as neverOpened.
      openAskPendingStore(opts.dataDir).set({
        listingId: opts.listingId,
        sellerTokenId: opts.sellerTokenId,
        hash,
        nonce: String(nonce),
        broadcastAt: new Date().toISOString(),
      });
      const receipt = await waitReceipt(c.pub, hash, 1);
      if (receipt.status !== "success") {
        return { ok: false, error: "openAsk reverted on-chain.", chainOpen: true };
      }
      openAskPendingStore(opts.dataDir).clear(opts.listingId);
      return { ok: true, hash };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // If we already broadcast (hash set), never roll back on a failed / pending recheck (L2).
      // asks() for an unmined ask still looks like neverOpened (!used && !open).
      if (hash) {
        for (let i = 0; i < 3; i++) {
          if (i > 0) await new Promise((r) => setTimeout(r, 500 * i));
          const onchain = await readAskOnchain({ listingId: opts.listingId, env: opts.env });
          if (onchain.ok && onchain.ask.open) {
            openAskPendingStore(opts.dataDir).clear(opts.listingId);
            return {
              ok: false,
              error: msg + " (ask is open on-chain; log listing left open)",
              chainOpen: true,
            };
          }
          if (onchain.ok && onchain.ask.used && !onchain.ask.open) {
            openAskPendingStore(opts.dataDir).clear(opts.listingId);
            return {
              ok: false,
              error: msg + " (ask closed on-chain; log listing left open for reconcile)",
              chainOpen: true,
            };
          }
        }
        return {
          ok: false,
          error: msg + " (openAsk broadcast; log listing left pending)",
          chainOpen: true,
        };
      }
      return { ok: false, error: msg, chainOpen: false };
    }
  });
}

export async function cancelAskOnchain(opts: {
  listingId: string;
  env?: NodeJS.ProcessEnv;
  dataDir?: string;
}): Promise<
  | { ok: true; hash: Hex; alreadyClosed?: boolean; neverOpened?: boolean; pendingOpen?: boolean }
  | { ok: false; error: string }
> {
  return withOwnerKeyQueue(async () => {
    const c = client(opts.env);
    if (!c.ok) return c;

    let before = await readAskOnchain({ listingId: opts.listingId, env: opts.env });
    if (!before.ok) return before;
    const pending = openAskPendingStore(opts.dataDir).get(opts.listingId);
    // M-1: !used is neverOpened only when we never broadcast openAsk for this id.
    if (!before.ask.used) {
      if (!pending) {
        return { ok: true, hash: "0x" as Hex, neverOpened: true };
      }
      // Broadcast may still be in flight — wait for one confirmation, then re-read.
      try {
        await waitReceipt(c.pub, pending.hash as Hex, 1);
      } catch {
        /* receipt may fail; still re-check asks() */
      }
      const again = await readAskOnchain({ listingId: opts.listingId, env: opts.env });
      if (!again.ok) return again;
      if (again.ask.used && !again.ask.open) {
        openAskPendingStore(opts.dataDir).clear(opts.listingId);
        return { ok: true, hash: "0x" as Hex, alreadyClosed: true };
      }
      if (!again.ask.used) {
        return {
          ok: false,
          error:
            "openAsk was broadcast (tx " +
            pending.hash +
            ") but is not mined yet; refuse reclaim/cancel until the nonce settles",
        };
      }
      before = again;
    }
    if (!before.ask.open) {
      openAskPendingStore(opts.dataDir).clear(opts.listingId);
      return { ok: true, hash: "0x" as Hex, alreadyClosed: true };
    }

    try {
      const hash = await c.wallet.writeContract({
        address: c.escrow,
        abi: AH_ABI,
        functionName: "cancelAsk",
        args: [BigInt(opts.listingId)],
        account: c.account,
        chain: c.chain,
      });
      const receipt = await waitReceipt(c.pub, hash, cancelConfirmations(opts.env));
      if (receipt.status !== "success") {
        return { ok: false, error: "cancelAsk reverted on-chain." };
      }
      openAskPendingStore(opts.dataDir).clear(opts.listingId);
      return { ok: true, hash };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isAskClosedError(msg)) {
        openAskPendingStore(opts.dataDir).clear(opts.listingId);
        return { ok: true, hash: "0x" as Hex, alreadyClosed: true };
      }
      const again = await readAskOnchain({ listingId: opts.listingId, env: opts.env });
      if (again.ok && !again.ask.open) {
        openAskPendingStore(opts.dataDir).clear(opts.listingId);
        return { ok: true, hash: "0x" as Hex, alreadyClosed: true };
      }
      return { ok: false, error: msg };
    }
  });
}

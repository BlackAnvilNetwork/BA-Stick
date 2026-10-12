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
import { withOwnerKeyQueue } from "./owner-tx-queue";

const AH_ABI = [
  {
    type: "function",
    name: "openAsk",
    stateMutability: "nonpayable",
    inputs: [
      { name: "listingId", type: "uint256" },
      { name: "sellerTokenId", type: "uint256" },
      { name: "sellerPayout", type: "address" },
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
      { name: "sellerPayout", type: "address" },
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
  sellerPayout: string;
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
): Promise<TransactionReceipt> {
  return pub.waitForTransactionReceipt({ hash, confirmations: 1 });
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
        sellerPayout: row[0],
        sellerTokenId: row[1].toString(),
        itemId: row[2].toString(),
        amount: row[3].toString(),
        priceWei: row[4].toString(),
        open: row[5],
        used: row[6],
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
  sellerPayout: string;
  itemId: string;
  amount: string;
  priceWei: string;
  env?: NodeJS.ProcessEnv;
}): Promise<{ ok: true; hash: Hex } | { ok: false; error: string; chainOpen?: boolean }> {
  return withOwnerKeyQueue(async () => {
    const c = client(opts.env);
    if (!c.ok) return c;
    if (!/^0x[0-9a-fA-F]{40}$/.test(opts.sellerPayout)) {
      return { ok: false, error: "Seller payout wallet is missing. Nothing was listed on-chain." };
    }
    let hash: Hex | undefined;
    try {
      hash = await c.wallet.writeContract({
        address: c.escrow,
        abi: AH_ABI,
        functionName: "openAsk",
        args: [
          BigInt(opts.listingId),
          BigInt(opts.sellerTokenId),
          opts.sellerPayout as `0x${string}`,
          BigInt(opts.itemId),
          BigInt(opts.amount),
          BigInt(opts.priceWei),
        ],
        account: c.account,
        chain: c.chain,
      });
      const receipt = await waitReceipt(c.pub, hash);
      if (receipt.status !== "success") {
        return { ok: false, error: "openAsk reverted on-chain." };
      }
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
            return {
              ok: false,
              error: msg + " (ask is open on-chain; log listing left open)",
              chainOpen: true,
            };
          }
          if (onchain.ok && onchain.ask.used && !onchain.ask.open) {
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
}): Promise<
  | { ok: true; hash: Hex; alreadyClosed?: boolean; neverOpened?: boolean }
  | { ok: false; error: string }
> {
  return withOwnerKeyQueue(async () => {
    const c = client(opts.env);
    if (!c.ok) return c;

    const before = await readAskOnchain({ listingId: opts.listingId, env: opts.env });
    if (!before.ok) return before;
    // Pre-AhEscrow (or never successfully opened): cancel on the log only.
    if (!before.ask.used) {
      return { ok: true, hash: "0x" as Hex, neverOpened: true };
    }
    if (!before.ask.open) {
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
      const receipt = await waitReceipt(c.pub, hash);
      if (receipt.status !== "success") {
        return { ok: false, error: "cancelAsk reverted on-chain." };
      }
      return { ok: true, hash };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isAskClosedError(msg)) {
        return { ok: true, hash: "0x" as Hex, alreadyClosed: true };
      }
      const again = await readAskOnchain({ listingId: opts.listingId, env: opts.env });
      if (again.ok && !again.ask.open) {
        return { ok: true, hash: "0x" as Hex, alreadyClosed: true };
      }
      return { ok: false, error: msg };
    }
  });
}

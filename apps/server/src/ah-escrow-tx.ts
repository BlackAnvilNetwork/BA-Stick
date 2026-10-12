/**
 * Serialized AhEscrow txs via viem (no private key on the cast argv).
 * Shares the owner-key queue with lok-vault so listing + mint never nonce-collide.
 *
 * Queue holds only broadcast + 1 confirmation. Finality waits run outside the queue
 * so cancel/reclaim cannot starve openAsk (re-test #2).
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
] as const;

const ASK_CLOSED_SELECTOR = "0x2d47378f"; // AskClosed()

export type OnchainAsk = {
  sellerTokenId: string;
  itemId: string;
  amount: string;
  priceWei: string;
  open: boolean;
  used: boolean;
};

function readClient(env: NodeJS.ProcessEnv = process.env) {
  const cfg = ahEscrowClientConfig(env);
  if (!cfg) {
    return { ok: false as const, error: "AhEscrow client is not configured." };
  }
  const escrow = ahEscrowAddress(env);
  if (!escrow) return { ok: false as const, error: "AhEscrow address missing." };
  const chain: Chain = {
    id: cfg.chainId,
    name: "settlement",
    nativeCurrency: { name: "xDAI", symbol: "xDAI", decimals: 18 },
    rpcUrls: { default: { http: [cfg.rpcUrl] } },
  };
  const pub = createPublicClient({ chain, transport: http(cfg.rpcUrl) });
  return { ok: true as const, pub, escrow: escrow as `0x${string}`, cfg, chain };
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

/**
 * Resolve a stuck openAsk pending record (reverted / replaced / dropped).
 * Returns neverOpened when the broadcast did not leave an open ask.
 */
async function resolvePendingOpenAsk(opts: {
  listingId: string;
  env?: NodeJS.ProcessEnv;
  dataDir?: string;
  pub: ReturnType<typeof createPublicClient>;
  listingAddress: `0x${string}`;
}): Promise<
  | { action: "neverOpened" }
  | { action: "alreadyClosed" }
  | { action: "open" }
  | { action: "wait"; error: string }
> {
  const store = openAskPendingStore(opts.dataDir);
  const pending = store.get(opts.listingId);
  if (!pending) return { action: "neverOpened" };

  let receipt: TransactionReceipt | null = null;
  try {
    receipt = await opts.pub.getTransactionReceipt({ hash: pending.hash as Hex });
  } catch {
    receipt = null;
  }

  if (receipt) {
    if (receipt.status === "reverted") {
      store.clear(opts.listingId);
      return { action: "neverOpened" };
    }
    // Mined successfully — ask should be used/open (or already filled/cancelled).
    const onchain = await readAskOnchain({ listingId: opts.listingId, env: opts.env });
    if (!onchain.ok) return { action: "wait", error: onchain.error };
    store.clear(opts.listingId);
    if (onchain.ask.open) return { action: "open" };
    if (onchain.ask.used) return { action: "alreadyClosed" };
    return { action: "neverOpened" };
  }

  // No receipt yet — if the LISTING nonce has moved past the broadcast nonce, the tx was dropped/replaced.
  try {
    const minedNonce = await opts.pub.getTransactionCount({
      address: opts.listingAddress,
      blockTag: "latest",
    });
    if (minedNonce > BigInt(pending.nonce)) {
      store.clear(opts.listingId);
      const onchain = await readAskOnchain({ listingId: opts.listingId, env: opts.env });
      if (onchain.ok && onchain.ask.open) return { action: "open" };
      if (onchain.ok && onchain.ask.used) return { action: "alreadyClosed" };
      return { action: "neverOpened" };
    }
  } catch (err) {
    return {
      action: "wait",
      error: err instanceof Error ? err.message : String(err),
    };
  }

  return {
    action: "wait",
    error:
      "openAsk was broadcast (tx " +
      pending.hash +
      ") but is not mined yet; refuse reclaim/cancel until the nonce settles (ops: replace/cancel same nonce or wait)",
  };
}

/**
 * Same-nonce replacement: cancel an open ask, or a no-op self-transfer if the openAsk never mined.
 * Used when a pending openAsk is stuck in the mempool.
 */
export async function replacePendingOpenAsk(opts: {
  listingId: string;
  env?: NodeJS.ProcessEnv;
  dataDir?: string;
}): Promise<{ ok: true; hash: Hex; cleared: boolean } | { ok: false; error: string }> {
  return withOwnerKeyQueue(async () => {
    const c = client(opts.env);
    if (!c.ok) return c;
    const pending = openAskPendingStore(opts.dataDir).get(opts.listingId);
    if (!pending) return { ok: false, error: "No pending openAsk for this listing." };
    const resolved = await resolvePendingOpenAsk({
      listingId: opts.listingId,
      env: opts.env,
      dataDir: opts.dataDir,
      pub: c.pub,
      listingAddress: c.account.address,
    });
    if (resolved.action === "neverOpened") {
      return { ok: true, hash: "0x" as Hex, cleared: true };
    }
    if (resolved.action === "alreadyClosed") {
      return { ok: true, hash: "0x" as Hex, cleared: true };
    }
    if (resolved.action === "open") {
      // Ask is open — cancel it (1 conf inside queue).
      try {
        const hash = await c.wallet.writeContract({
          address: c.escrow,
          abi: AH_ABI,
          functionName: "cancelAsk",
          args: [BigInt(opts.listingId)],
          account: c.account,
          chain: c.chain,
        });
        const receipt = await waitReceipt(c.pub, hash, 1);
        if (receipt.status !== "success") {
          return { ok: false, error: "replacement cancelAsk reverted" };
        }
        openAskPendingStore(opts.dataDir).clear(opts.listingId);
        return { ok: true, hash, cleared: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
    // Still in mempool at the same nonce — replace with a 0-value self send to clear the nonce.
    try {
      const hash = await c.wallet.sendTransaction({
        account: c.account,
        chain: c.chain,
        to: c.account.address,
        value: 0n,
        nonce: Number(pending.nonce),
      });
      const receipt = await waitReceipt(c.pub, hash, 1);
      openAskPendingStore(opts.dataDir).clear(opts.listingId);
      if (receipt.status !== "success") {
        return { ok: false, error: "nonce-replacement tx reverted" };
      }
      return { ok: true, hash, cleared: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
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
        // Reverted (e.g. paused): clear pending and undo log listing (chainOpen:false).
        openAskPendingStore(opts.dataDir).clear(opts.listingId);
        return { ok: false, error: "openAsk reverted on-chain.", chainOpen: false };
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
          // Mined but reverted → treat as not open.
          try {
            const receipt = await c.pub.getTransactionReceipt({ hash });
            if (receipt.status === "reverted") {
              openAskPendingStore(opts.dataDir).clear(opts.listingId);
              return { ok: false, error: msg + " (openAsk reverted)", chainOpen: false };
            }
          } catch {
            /* still pending */
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
  const env = opts.env;
  // Phase 1 (inside queue): resolve pending openAsk, broadcast cancel, wait 1 confirmation.
  const phase1 = await withOwnerKeyQueue(async () => {
    const c = client(env);
    if (!c.ok) return c;

    let before = await readAskOnchain({ listingId: opts.listingId, env });
    if (!before.ok) return before;
    const pending = openAskPendingStore(opts.dataDir).get(opts.listingId);

    if (!before.ask.used) {
      if (!pending) {
        return { ok: true as const, hash: "0x" as Hex, neverOpened: true as const };
      }
      const resolved = await resolvePendingOpenAsk({
        listingId: opts.listingId,
        env,
        dataDir: opts.dataDir,
        pub: c.pub,
        listingAddress: c.account.address,
      });
      if (resolved.action === "neverOpened") {
        return { ok: true as const, hash: "0x" as Hex, neverOpened: true as const };
      }
      if (resolved.action === "alreadyClosed") {
        return { ok: true as const, hash: "0x" as Hex, alreadyClosed: true as const };
      }
      if (resolved.action === "wait") {
        return { ok: false as const, error: resolved.error };
      }
      // open — fall through to cancel
      before = await readAskOnchain({ listingId: opts.listingId, env });
      if (!before.ok) return before;
    }

    if (!before.ask.open) {
      openAskPendingStore(opts.dataDir).clear(opts.listingId);
      return { ok: true as const, hash: "0x" as Hex, alreadyClosed: true as const };
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
      const receipt = await waitReceipt(c.pub, hash, 1);
      if (receipt.status !== "success") {
        return { ok: false as const, error: "cancelAsk reverted on-chain." };
      }
      openAskPendingStore(opts.dataDir).clear(opts.listingId);
      return {
        ok: true as const,
        hash,
        needsFinality: true as const,
        rpcUrl: c.cfg.rpcUrl,
        chainId: c.cfg.chainId,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isAskClosedError(msg)) {
        openAskPendingStore(opts.dataDir).clear(opts.listingId);
        return { ok: true as const, hash: "0x" as Hex, alreadyClosed: true as const };
      }
      const again = await readAskOnchain({ listingId: opts.listingId, env });
      if (again.ok && !again.ask.open) {
        openAskPendingStore(opts.dataDir).clear(opts.listingId);
        return { ok: true as const, hash: "0x" as Hex, alreadyClosed: true as const };
      }
      return { ok: false as const, error: msg };
    }
  });

  if (!phase1.ok) return phase1;
  if (!("needsFinality" in phase1) || !phase1.needsFinality || phase1.hash === "0x") {
    return {
      ok: true,
      hash: phase1.hash,
      alreadyClosed: "alreadyClosed" in phase1 ? phase1.alreadyClosed : undefined,
      neverOpened: "neverOpened" in phase1 ? phase1.neverOpened : undefined,
    };
  }

  // Phase 2 (outside queue): wait for settlement depth before caller releases log escrow.
  const depth = cancelConfirmations(env);
  if (depth > 1) {
    try {
      const pub = createPublicClient({
        chain: {
          id: phase1.chainId,
          name: "settlement",
          nativeCurrency: { name: "xDAI", symbol: "xDAI", decimals: 18 },
          rpcUrls: { default: { http: [phase1.rpcUrl] } },
        },
        transport: http(phase1.rpcUrl),
      });
      await waitReceipt(pub, phase1.hash, depth);
    } catch (err) {
      return {
        ok: false,
        error:
          "cancelAsk mined but finality wait failed: " +
          (err instanceof Error ? err.message : String(err)) +
          " — log escrow not released yet",
      };
    }
  }
  return { ok: true, hash: phase1.hash };
}

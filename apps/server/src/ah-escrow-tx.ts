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
import {
  ahEscrowAddress,
  ahEscrowClientConfig,
  ASK_CANCELLED_TOPIC,
  listingRoleKey,
} from "./ah-escrow";
import { cancelTxRecordStore } from "./cancel-tx-record";
import { consumeGlobalListingTxBudget } from "./lok-list-rate";
import { openAskPendingStore } from "./open-ask-pending";
import { withOwnerKeyQueue } from "./owner-tx-queue";
import { chainBoundSendGate, chainBoundXdaiSend, releaseEpochXdai } from "./root-anchor";
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
  {
    type: "event",
    name: "AskCancelled",
    inputs: [{ name: "listingId", type: "uint256", indexed: true }],
  },
  { type: "error", name: "AskClosed" },
  { type: "error", name: "AskExists" },
  { type: "error", name: "BadAmount" },
  { type: "error", name: "BadId" },
  { type: "error", name: "Unauthorized" },
  { type: "error", name: "EnforcedPause" },
] as const;

/** keccak256("AskClosed()")[0:4] */
export const ASK_CLOSED_SELECTOR = "0x756918b7";

/** Finality wait for cancel must cover ~30 Gnosis blocks (~2.5m) + slack. */
export const CANCEL_FINALITY_TIMEOUT_MS = 900_000;

function listingIdTopic(listingId: string): Hex {
  return ("0x" + BigInt(listingId).toString(16).padStart(64, "0")) as Hex;
}

/** Minimal receipt shape for AskCancelled checks (avoids full viem Log required fields in tests). */
export type AskCancelReceiptView = {
  status: TransactionReceipt["status"];
  logs: readonly {
    address: string;
    topics: readonly (string | null | undefined)[];
    data?: string;
  }[];
};

/**
 * True only when the receipt succeeded and contains AskCancelled(listingId).
 * Reverted cancels (race with buyAsk / Unauthorized) must not release log escrow.
 */
export function cancelReceiptProvesAskCancelled(
  receipt: AskCancelReceiptView,
  listingId: string,
  escrow?: string,
): boolean {
  if (receipt.status !== "success") return false;
  const topic1 = listingIdTopic(listingId).toLowerCase();
  const topic0 = ASK_CANCELLED_TOPIC.toLowerCase();
  const esc = escrow?.toLowerCase();
  return receipt.logs.some((log) => {
    if (esc && log.address.toLowerCase() !== esc) return false;
    const t0 = log.topics[0]?.toLowerCase();
    const t1 = log.topics[1]?.toLowerCase();
    return t0 === topic0 && t1 === topic1;
  });
}

/** Decision for a recorded cancelAsk hash once its receipt is available. */
export type RecordedCancelDecision =
  | { decision: "serverCancelled" }
  | { decision: "notOurCancel" };

export function decideRecordedCancelReceipt(
  receipt: AskCancelReceiptView,
  listingId: string,
  escrow?: string,
): RecordedCancelDecision {
  if (cancelReceiptProvesAskCancelled(receipt, listingId, escrow)) {
    return { decision: "serverCancelled" };
  }
  return { decision: "notOurCancel" };
}

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
  timeoutMs?: number,
): Promise<TransactionReceipt> {
  return pub.waitForTransactionReceipt({
    hash,
    confirmations: confirmations >= 1 ? confirmations : 1,
    ...(timeoutMs != null ? { timeout: timeoutMs } : {}),
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
    // viem's inferred return can widen to unknown under some TS configs; asks() is fixed.
    const row = (await c.pub.readContract({
      address: c.escrow,
      abi: AH_ABI,
      functionName: "asks",
      args: [BigInt(opts.listingId)],
    })) as readonly [bigint, bigint, bigint, bigint, boolean, boolean];
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
      const gate = chainBoundSendGate();
      if (!gate.ok) return gate;
      try {
        const budget = consumeGlobalListingTxBudget({ dataDir: opts.dataDir });
        if (!budget.ok) return budget;
        const hash = await c.wallet.writeContract({
          address: c.escrow,
          abi: AH_ABI,
          functionName: "cancelAsk",
          args: [BigInt(opts.listingId)],
          account: c.account,
          chain: c.chain,
        });
        const receipt = await waitReceipt(c.pub, hash, 1);
        if (!cancelReceiptProvesAskCancelled(receipt, opts.listingId, c.escrow)) {
          return { ok: false, error: "replacement cancelAsk reverted or missing AskCancelled" };
        }
        openAskPendingStore(opts.dataDir).clear(opts.listingId);
        cancelTxRecordStore(opts.dataDir).set(opts.listingId, hash);
        return { ok: true, hash, cleared: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
    // Still in mempool at the same nonce — replace with a fee-bumped 0-value self send.
    const replaceGate = chainBoundSendGate();
    if (!replaceGate.ok) return replaceGate;
    try {
      let maxFeePerGas: bigint | undefined;
      let maxPriorityFeePerGas: bigint | undefined;
      let gasPrice: bigint | undefined;
      try {
        const stuck = await c.pub.getTransaction({ hash: pending.hash as Hex });
        if (stuck.maxFeePerGas != null) maxFeePerGas = (stuck.maxFeePerGas * 1125n) / 1000n;
        if (stuck.maxPriorityFeePerGas != null) {
          maxPriorityFeePerGas = (stuck.maxPriorityFeePerGas * 1125n) / 1000n;
        }
        // Legacy (pre-1559) stuck txs: bump gasPrice; do not fall back to a lower estimate.
        if (maxFeePerGas == null && stuck.gasPrice != null) {
          gasPrice = (stuck.gasPrice * 1125n) / 1000n;
        }
      } catch {
        /* bump from pending fee if available */
      }
      if (gasPrice == null && (maxFeePerGas == null || maxPriorityFeePerGas == null)) {
        const fees = await c.pub.estimateFeesPerGas();
        maxFeePerGas = maxFeePerGas ?? ((fees.maxFeePerGas ?? 1n) * 1125n) / 1000n;
        maxPriorityFeePerGas =
          maxPriorityFeePerGas ?? ((fees.maxPriorityFeePerGas ?? 1n) * 1125n) / 1000n;
      }
      const budget = consumeGlobalListingTxBudget({ dataDir: opts.dataDir });
      if (!budget.ok) return budget;
      const hash = await c.wallet.sendTransaction({
        account: c.account,
        chain: c.chain,
        to: c.account.address,
        value: 0n,
        nonce: Number(pending.nonce),
        ...(gasPrice != null
          ? { gasPrice }
          : { maxFeePerGas, maxPriorityFeePerGas }),
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

function parseAskPrice(value: string): bigint | null {
  if (!/^\d+$/.test(value)) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
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
  const gate = chainBoundSendGate();
  if (!gate.ok) return gate;
  const price = parseAskPrice(opts.priceWei);
  let reserved: { amount: bigint; epoch: number } | null = null;
  if (price != null) {
    const admitted = chainBoundXdaiSend("escrow", price);
    if (!admitted.ok) return admitted;
    reserved = { amount: price, epoch: admitted.epoch };
  }
  const release = () => {
    if (!reserved) return;
    releaseEpochXdai(reserved.amount, reserved.epoch);
    reserved = null;
  };
  try {
    const result = await withOwnerKeyQueue<
      { ok: true; hash: Hex } | { ok: false; error: string; chainOpen?: boolean }
    >(async () => {
    const c = client(opts.env);
    if (!c.ok) return c;
    const budget = consumeGlobalListingTxBudget({ dataDir: opts.dataDir });
    if (!budget.ok) return budget;
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
    if (!result.ok && result.chainOpen !== true) release();
    return result;
  } catch (err) {
    release();
    throw err;
  }
}

/**
 * Verify a recorded cancelAsk receipt proves AskCancelled. Clears the record when
 * the tx reverted or succeeded without AskCancelled (buy race / Unauthorized).
 *
 * When `pollOnly` is set (LISTING queue path), uses a single getTransactionReceipt
 * with no wait — pending/dropped hashes return keepWaiting so the queue is not held.
 */
async function verifyRecordedCancel(opts: {
  listingId: string;
  hash: Hex;
  pub: ReturnType<typeof createPublicClient>;
  escrow: `0x${string}`;
  confirmations: number;
  timeoutMs?: number;
  dataDir?: string;
  /** Inside the LISTING queue: one receipt poll, never waitForTransactionReceipt. */
  pollOnly?: boolean;
}): Promise<
  | { ok: true; serverCancelled: true }
  | { ok: false; keepWaiting: true; error: string }
  | { ok: false; notOurCancel: true }
> {
  const cancels = cancelTxRecordStore(opts.dataDir);
  let receipt: TransactionReceipt;
  if (opts.pollOnly) {
    try {
      receipt = await opts.pub.getTransactionReceipt({ hash: opts.hash });
    } catch {
      return {
        ok: false,
        keepWaiting: true,
        error:
          "server cancelAsk " +
          opts.hash +
          " receipt not mined yet — retry; log escrow not released yet",
      };
    }
  } else {
    try {
      receipt = await waitReceipt(
        opts.pub,
        opts.hash,
        opts.confirmations >= 1 ? opts.confirmations : 1,
        opts.timeoutMs,
      );
    } catch (err) {
      return {
        ok: false,
        keepWaiting: true,
        error:
          "server cancelAsk " +
          opts.hash +
          " finality wait failed: " +
          (err instanceof Error ? err.message : String(err)) +
          " — retry; log escrow not released yet",
      };
    }
  }
  const decided = decideRecordedCancelReceipt(receipt, opts.listingId, opts.escrow);
  if (decided.decision === "serverCancelled") {
    return { ok: true, serverCancelled: true };
  }
  // Reverted or mined without AskCancelled — never release log escrow.
  cancels.clear(opts.listingId);
  return { ok: false, notOurCancel: true };
}

/** Serialize cancel/reclaim for the same listingId (N-2). */
const listingCancelLocks = new Map<string, Promise<unknown>>();

export async function withListingCancelLock<T>(
  listingId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const prev = listingCancelLocks.get(listingId) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chained = prev.then(
    () => gate,
    () => gate,
  );
  listingCancelLocks.set(listingId, chained);
  try {
    await prev.then(
      () => undefined,
      () => undefined,
    );
    return await fn();
  } finally {
    release();
    if (listingCancelLocks.get(listingId) === chained) {
      listingCancelLocks.delete(listingId);
    }
  }
}

export function resetListingCancelLocksForTests(): void {
  listingCancelLocks.clear();
}

export async function cancelAskOnchain(opts: {
  listingId: string;
  env?: NodeJS.ProcessEnv;
  dataDir?: string;
}): Promise<
  | {
      ok: true;
      hash: Hex;
      alreadyClosed?: boolean;
      /** This server's own cancelAsk mined with AskCancelled — safe to release log escrow. */
      serverCancelled?: boolean;
      neverOpened?: boolean;
      pendingOpen?: boolean;
    }
  | { ok: false; error: string }
> {
  return withListingCancelLock(opts.listingId, () => cancelAskOnchainUnlocked(opts));
}

async function cancelAskOnchainUnlocked(opts: {
  listingId: string;
  env?: NodeJS.ProcessEnv;
  dataDir?: string;
}): Promise<
  | {
      ok: true;
      hash: Hex;
      alreadyClosed?: boolean;
      serverCancelled?: boolean;
      neverOpened?: boolean;
      pendingOpen?: boolean;
    }
  | { ok: false; error: string }
> {
  const env = opts.env;
  const cancels = cancelTxRecordStore(opts.dataDir);

  // Retry path: we already broadcast cancelAsk; finish finality + release only if AskCancelled.
  const prior = cancels.get(opts.listingId);
  if (prior && /^0x[0-9a-fA-F]{64}$/.test(prior.hash)) {
    const c = readClient(env);
    if (c.ok) {
      const depth = cancelConfirmations(env);
      const verified = await verifyRecordedCancel({
        listingId: opts.listingId,
        hash: prior.hash as Hex,
        pub: c.pub,
        escrow: c.escrow,
        confirmations: depth > 1 ? depth : 1,
        timeoutMs: CANCEL_FINALITY_TIMEOUT_MS,
        dataDir: opts.dataDir,
      });
      if (verified.ok) {
        cancels.clear(opts.listingId);
        openAskPendingStore(opts.dataDir).clear(opts.listingId);
        return { ok: true, hash: prior.hash as Hex, serverCancelled: true };
      }
      if ("keepWaiting" in verified && verified.keepWaiting) {
        return { ok: false, error: verified.error };
      }
      // notOurCancel: record cleared; fall through (ask may still be open, or filled).
    }
  }

  // Phase 1 (inside queue): resolve pending openAsk, broadcast cancel, wait 1 confirmation.
  const phase1 = await withOwnerKeyQueue(async () => {
    const c = client(env);
    if (!c.ok) return c;

    /**
     * Only treat a recorded hash as our cancel after AskCancelled is proven.
     * Poll receipt once (no 15m wait) so a pending/dropped hash cannot stall LISTING.
     */
    const verifiedRecordedOrAlreadyClosed = async (): Promise<
      | {
          ok: true;
          hash: Hex;
          serverCancelled: true;
          needsFinality: true;
          rpcUrl: string;
          chainId: number;
        }
      | { ok: true; hash: Hex; alreadyClosed: true }
      | { ok: false; error: string }
    > => {
      const recorded = cancels.get(opts.listingId);
      if (recorded && /^0x[0-9a-fA-F]{64}$/.test(recorded.hash)) {
        const verified = await verifyRecordedCancel({
          listingId: opts.listingId,
          hash: recorded.hash as Hex,
          pub: c.pub,
          escrow: c.escrow,
          confirmations: 1,
          dataDir: opts.dataDir,
          pollOnly: true,
        });
        if (verified.ok) {
          return {
            ok: true as const,
            hash: recorded.hash as Hex,
            serverCancelled: true as const,
            needsFinality: true as const,
            rpcUrl: c.cfg.rpcUrl,
            chainId: c.cfg.chainId,
          };
        }
        if ("keepWaiting" in verified && verified.keepWaiting) {
          return { ok: false as const, error: verified.error };
        }
      }
      return { ok: true as const, hash: "0x" as Hex, alreadyClosed: true as const };
    };

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
        return verifiedRecordedOrAlreadyClosed();
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
      return verifiedRecordedOrAlreadyClosed();
    }

    const gate = chainBoundSendGate();
    if (!gate.ok) return gate;
    const budget = consumeGlobalListingTxBudget({ dataDir: opts.dataDir });
    if (!budget.ok) return budget;

    try {
      const hash = await c.wallet.writeContract({
        address: c.escrow,
        abi: AH_ABI,
        functionName: "cancelAsk",
        args: [BigInt(opts.listingId)],
        account: c.account,
        chain: c.chain,
      });
      // Record before finality so a timeout retry can release the log — cleared on revert.
      cancels.set(opts.listingId, hash);
      const receipt = await waitReceipt(c.pub, hash, 1);
      if (!cancelReceiptProvesAskCancelled(receipt, opts.listingId, c.escrow)) {
        cancels.clear(opts.listingId);
        // Buy race / Unauthorized: ask may be closed (fill) or still open.
        if (receipt.status !== "success") {
          const again = await readAskOnchain({ listingId: opts.listingId, env });
          if (again.ok && !again.ask.open) {
            openAskPendingStore(opts.dataDir).clear(opts.listingId);
            return { ok: true as const, hash: "0x" as Hex, alreadyClosed: true as const };
          }
          return { ok: false as const, error: "cancelAsk reverted on-chain." };
        }
        openAskPendingStore(opts.dataDir).clear(opts.listingId);
        return { ok: true as const, hash: "0x" as Hex, alreadyClosed: true as const };
      }
      openAskPendingStore(opts.dataDir).clear(opts.listingId);
      return {
        ok: true as const,
        hash,
        serverCancelled: true as const,
        needsFinality: true as const,
        rpcUrl: c.cfg.rpcUrl,
        chainId: c.cfg.chainId,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // If we never got a successful AskCancelled receipt, drop any stale record.
      const recorded = cancels.get(opts.listingId);
      if (recorded) {
        try {
          const rcpt = await c.pub.getTransactionReceipt({ hash: recorded.hash as Hex });
          if (!cancelReceiptProvesAskCancelled(rcpt, opts.listingId, c.escrow)) {
            cancels.clear(opts.listingId);
          }
        } catch {
          /* still pending — keep for timeout retry */
        }
      }
      if (isAskClosedError(msg)) {
        openAskPendingStore(opts.dataDir).clear(opts.listingId);
        return verifiedRecordedOrAlreadyClosed();
      }
      const again = await readAskOnchain({ listingId: opts.listingId, env });
      if (again.ok && !again.ask.open) {
        openAskPendingStore(opts.dataDir).clear(opts.listingId);
        return verifiedRecordedOrAlreadyClosed();
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
      serverCancelled: "serverCancelled" in phase1 ? phase1.serverCancelled : undefined,
      neverOpened: "neverOpened" in phase1 ? phase1.neverOpened : undefined,
    };
  }

  // Phase 2 (outside queue): wait for settlement depth; re-check AskCancelled before release.
  const depth = cancelConfirmations(env);
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
    const escrow = ahEscrowAddress(env) as `0x${string}` | null;
    if (!escrow) {
      return { ok: false, error: "AhEscrow address missing." };
    }
    const verified = await verifyRecordedCancel({
      listingId: opts.listingId,
      hash: phase1.hash,
      pub,
      escrow,
      confirmations: depth > 1 ? depth : 1,
      timeoutMs: CANCEL_FINALITY_TIMEOUT_MS,
      dataDir: opts.dataDir,
    });
    if (!verified.ok) {
      if ("keepWaiting" in verified && verified.keepWaiting) {
        return { ok: false, error: verified.error };
      }
      return { ok: true, hash: "0x" as Hex, alreadyClosed: true };
    }
    cancels.clear(opts.listingId);
  } catch (err) {
    // Keep cancel-tx record so retry can finish after AskCancelled is proven.
    return {
      ok: false,
      error:
        "cancelAsk mined (" +
        phase1.hash +
        ") but finality wait failed: " +
        (err instanceof Error ? err.message : String(err)) +
        " — retry; log escrow not released yet",
    };
  }
  return { ok: true, hash: phase1.hash, serverCancelled: true };
}

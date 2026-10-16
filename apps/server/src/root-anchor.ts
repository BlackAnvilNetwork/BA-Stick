/**
 * Post a certified lok-order batch to the local root anchor.
 *
 * The posted `nextRoot` is the character-root tree the orderer certified.
 * A batch is anchored only after `post` succeeds and `isAnchored` reads back.
 * A status line that claims an anchored height does not count. Gnosis mainnet
 * (100) and Chiado (10200) are refused, and the RPC must be loopback anvil.
 *
 * The signer is `LOK_ANCHOR_POSTER_KEY`. This module does not sign with
 * `LOK_OWNER_KEY`, `PRIVATE_KEY`, or `LOK_LISTING_KEY`. Combat, movement,
 * loot, and the 20 Hz tick do not wait on this module.
 *
 * A successful post sets the anchored height immediately. Chain-bound sends
 * still wait one day from that anchor. The day is the ruleset timelock floor
 * (`RulesetRegistry.MIN_DELAY` is 1 day). It is not `PvpBounty.claimDelay`.
 *
 * Chain-bound xDAI settled in one epoch is at most 10% of the slashable bonds
 * posted then. The epoch is the 10-second seed epoch. Mint fees, AhEscrow
 * buyAsk value, PvpBounty executeClaim payouts, PvpBounty cancel refunds,
 * and withdrawal value share that total. Opening an ask does not settle xDAI.
 * The buyAsk transfer and the cancel refund are not broadcast until this epoch
 * admits them. In-game gold does not. The denominator is the slashable bonds
 * posted for the epoch, kept in the epoch ledger with the xDAI already charged.
 * A restart reads that ledger. This module does not invent a bond. Until a
 * bond is posted, the cap is zero.
 *
 * `withdrawKek` and bag export are not chain withdrawals. `beginChainWithdrawal`
 * is the hold those sends must pass, and it does not broadcast.
 */
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  parseAbi,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { durableWrite } from "./durable-write";

export const ANCHOR_WAIT = "Waiting for an anchored root.";

/** One day. Same floor as `RulesetRegistry.MIN_DELAY`. Not `PvpBounty.claimDelay`. */
export const CHALLENGE_DELAY_MS = 24 * 60 * 60 * 1000;

export const CHALLENGE_WAIT = "Waiting for the one-day challenge delay.";

/** Seed epoch. The spec starts it at 10 seconds. */
export const EPOCH_MS = 10_000;

export const EPOCH_XDAI_CAP_REFUSAL =
  "Chain-bound xDAI in this epoch is above 10% of the slashable bonds posted.";

export type ChainXdaiKind = "mint" | "escrow" | "bounty" | "withdrawal";

const EPOCH_LEDGER_NAME = "epoch-xdai.json";

let postedBondsWei = 0n;
const settledByEpoch = new Map<number, bigint>();
const pinnedCharges = new Set<string>();
const observedEscrowFills = new Map<string, number>();
let ledgerDir: string | null = null;
let suppressPersist = false;

/** Ask xDAI reserved before buyAsk, or counted when AskFilled is already logged. */
type EscrowCharge = { amount: bigint; epoch: number; fillKey?: string; landed?: boolean };
const escrowCharges: EscrowCharge[] = [];

let readClock: () => number = () => Date.now();

/** Tests advance this instead of waiting out the day. Production uses `Date.now`. */
export function setChallengeClockForTests(now: () => number): void {
  readClock = now;
}

const ANVIL_CHAIN_ID = 31337;
const ROOT_ANCHOR_ABI = parseAbi([
  "function post(uint64 height, bytes32 nextRoot, bytes certificate)",
  "function isAnchored(uint64 height, bytes32 nextRoot) view returns (bool)",
]);

export type CertifiedBatch = {
  height: number;
  nextRoot: Uint8Array;
  certificate: Uint8Array;
};

export type AnchorPoster = (batch: CertifiedBatch) => Promise<boolean>;

type AnchoredRoot = {
  height: number;
  nextRoot: Uint8Array;
};

let certified: AnchoredRoot | null = null;
let anchored = new Map<number, Uint8Array>();
let anchoredAt = new Map<number, number>();
let lastPostedHeight: number | null = null;
const posting = new Set<number>();

export function resetRootAnchorForTests(): void {
  const dir = ledgerDir;
  ledgerDir = null;
  certified = null;
  anchored = new Map();
  anchoredAt = new Map();
  lastPostedHeight = null;
  posting.clear();
  clearEpochMemory();
  readClock = () => Date.now();
  if (dir) rmSync(join(dir, EPOCH_LEDGER_NAME), { force: true });
}

/**
 * Posted slashable-bond total, in wei. The cap reads this input.
 * This module does not pick a bond amount.
 */
export function setPostedSlashableBonds(wei: bigint): void {
  if (wei < 0n) throw new Error("Posted slashable bonds cannot be negative.");
  postedBondsWei = wei;
  persistLedger();
}

export function postedSlashableBonds(): bigint {
  return postedBondsWei;
}

/** 10% of the bonds posted now. Floors. Zero bonds are a zero cap. */
export function epochXdaiCapWei(bondsWei: bigint = postedBondsWei): bigint {
  if (bondsWei <= 0n) return 0n;
  return (bondsWei * 10n) / 100n;
}

export function epochIndex(atMs: number): number {
  return Math.floor(atMs / EPOCH_MS);
}

/** Chain-bound xDAI charged to the epoch `atMs` falls in. Defaults to the clock. */
export function epochSettledXdai(atMs?: number): bigint {
  const epoch = epochIndex(atMs ?? readClock());
  return settledByEpoch.get(epoch) ?? 0n;
}

function addEpoch(epoch: number, amountWei: bigint): void {
  if (amountWei <= 0n) return;
  settledByEpoch.set(epoch, (settledByEpoch.get(epoch) ?? 0n) + amountWei);
  persistLedger();
}

function subtractEpoch(epoch: number, amountWei: bigint): void {
  if (amountWei <= 0n) return;
  const settled = settledByEpoch.get(epoch) ?? 0n;
  if (settled <= 0n) return;
  const next = settled > amountWei ? settled - amountWei : 0n;
  if (next === 0n) settledByEpoch.delete(epoch);
  else settledByEpoch.set(epoch, next);
  persistLedger();
}

function clearEpochMemory(): void {
  postedBondsWei = 0n;
  settledByEpoch.clear();
  pinnedCharges.clear();
  observedEscrowFills.clear();
  escrowCharges.length = 0;
}

type EpochLedgerFile = {
  postedBondsWei: string;
  settled: Record<string, string>;
  pins: string[];
  fills: Record<string, number>;
  charges: { amount: string; epoch: number; fillKey?: string }[];
};

function ledgerPath(): string | null {
  return ledgerDir ? join(ledgerDir, EPOCH_LEDGER_NAME) : null;
}

function persistLedger(): void {
  const path = ledgerPath();
  if (suppressPersist || !path) return;
  const settled: Record<string, string> = {};
  for (const [epoch, wei] of settledByEpoch) settled[String(epoch)] = wei.toString();
  const fills: Record<string, number> = {};
  for (const [key, epoch] of observedEscrowFills) fills[key] = epoch;
  const body: EpochLedgerFile = {
    postedBondsWei: postedBondsWei.toString(),
    settled,
    pins: [...pinnedCharges],
    fills,
    charges: escrowCharges.map((row) => ({
      amount: row.amount.toString(),
      epoch: row.epoch,
      fillKey: row.fillKey,
    })),
  };
  durableWrite(path, JSON.stringify(body) + "\n");
}

function loadLedger(): void {
  const path = ledgerPath();
  if (!path || !existsSync(path)) return;
  let parsed: EpochLedgerFile;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8")) as EpochLedgerFile;
  } catch {
    return;
  }
  suppressPersist = true;
  try {
    if (typeof parsed.postedBondsWei === "string" && /^\d+$/.test(parsed.postedBondsWei)) {
      postedBondsWei = BigInt(parsed.postedBondsWei);
    }
    if (parsed.settled && typeof parsed.settled === "object") {
      for (const [key, value] of Object.entries(parsed.settled)) {
        if (!/^-?\d+$/.test(key) || typeof value !== "string" || !/^\d+$/.test(value)) continue;
        const wei = BigInt(value);
        if (wei > 0n) settledByEpoch.set(Number(key), wei);
      }
    }
    for (const pin of parsed.pins ?? []) {
      if (typeof pin === "string" && pin.length > 0) pinnedCharges.add(pin);
    }
    if (parsed.fills && typeof parsed.fills === "object") {
      for (const [key, epoch] of Object.entries(parsed.fills)) {
        if (typeof epoch === "number") observedEscrowFills.set(key, epoch);
      }
    }
    for (const row of parsed.charges ?? []) {
      if (!row || typeof row.amount !== "string" || !/^\d+$/.test(row.amount) || typeof row.epoch !== "number") {
        continue;
      }
      escrowCharges.push({
        amount: BigInt(row.amount),
        epoch: row.epoch,
        fillKey: typeof row.fillKey === "string" ? row.fillKey : undefined,
      });
    }
  } finally {
    suppressPersist = false;
  }
}

/** Read the epoch ledger from `dir`. Later posts and charges are written there. */
export function configureEpochLedger(dir: string): void {
  ledgerDir = dir;
  loadLedger();
}

/**
 * Drop process memory and read the ledger again.
 * Bonds posted for the epoch, and xDAI already charged to it, stay.
 */
export function restartEpochLedger(): void {
  clearEpochMemory();
  loadLedger();
}

/** Latest height whose post succeeded. Null until then. */
export function anchoredHeight(): number | null {
  return lastPostedHeight;
}

export function noteCertifiedBatch(batch: CertifiedBatch): void {
  if (!validBatch(batch)) return;
  certified = { height: batch.height, nextRoot: batch.nextRoot.slice() };
}

/**
 * Chain-bound sends depend on the latest certified root. They proceed only
 * when that exact root has been posted and one day has passed from that post.
 * Play, movement, combat, and loot do not.
 */
export function chainBoundSendGate(): { ok: true } | { ok: false; error: string } {
  if (!certified) return { ok: false, error: ANCHOR_WAIT };
  const posted = anchored.get(certified.height);
  if (!posted || !bytesEqual(posted, certified.nextRoot)) {
    return { ok: false, error: ANCHOR_WAIT };
  }
  const postedAt = anchoredAt.get(certified.height);
  if (postedAt == null || readClock() - postedAt < CHALLENGE_DELAY_MS) {
    return { ok: false, error: CHALLENGE_WAIT };
  }
  return { ok: true };
}

/**
 * Admit one chain-bound xDAI send for this epoch.
 * Anchor and the one-day challenge delay still apply.
 * A send that would put the epoch total above 10% of the bonds posted now is refused
 * and is not counted. In-game gold is not passed here.
 */
export function chainBoundXdaiSend(
  kind: ChainXdaiKind,
  amountWei: bigint,
  atMs?: number,
): { ok: true; kind: ChainXdaiKind; epoch: number } | { ok: false; error: string } {
  const gate = chainBoundSendGate();
  if (!gate.ok) return gate;
  if (amountWei < 0n) return { ok: false, error: "Chain-bound xDAI amount is negative." };
  const epoch = epochIndex(atMs ?? readClock());
  const cap = epochXdaiCapWei();
  const settled = settledByEpoch.get(epoch) ?? 0n;
  if (settled + amountWei > cap) {
    return { ok: false, error: EPOCH_XDAI_CAP_REFUSAL };
  }
  addEpoch(epoch, amountWei);
  return { ok: true, kind, epoch };
}

/**
 * Reserve ask xDAI before `buyAsk` broadcasts the transfer.
 * Opening an ask does not call this. A refusal does not send the xDAI.
 * `atMs` is the epoch that will contain the payment.
 */
export function admitEscrowFill(
  priceWei: bigint,
  atMs?: number,
): { ok: true; kind: "escrow"; epoch: number } | { ok: false; error: string } {
  const admitted = chainBoundXdaiSend("escrow", priceWei, atMs);
  if (!admitted.ok) return admitted;
  escrowCharges.push({ amount: priceWei, epoch: admitted.epoch });
  persistLedger();
  return { ok: true, kind: "escrow", epoch: admitted.epoch };
}

/**
 * Count an AskFilled that already moved xDAI, in the epoch of that settlement.
 * A matching reservation is moved rather than counted twice.
 * The same fill key does not charge a later bucket.
 */
export function observeEscrowSettlement(fillKey: string, priceWei: bigint, atMs?: number): number {
  const seen = observedEscrowFills.get(fillKey);
  if (seen != null) return seen;
  const epoch = epochIndex(atMs ?? readClock());
  const charge = escrowCharges.find((row) => row.amount === priceWei && row.fillKey == null);
  if (charge) {
    charge.fillKey = fillKey;
    if (charge.epoch !== epoch) {
      const held = settledByEpoch.get(charge.epoch) ?? 0n;
      if (held >= priceWei) {
        subtractEpoch(charge.epoch, priceWei);
        addEpoch(epoch, priceWei);
        charge.epoch = epoch;
      }
    }
    observedEscrowFills.set(fillKey, charge.epoch);
    persistLedger();
    return charge.epoch;
  }
  addEpoch(epoch, priceWei);
  observedEscrowFills.set(fillKey, epoch);
  persistLedger();
  return epoch;
}

/**
 * Reserve bounty xDAI before it moves.
 * `executeClaim` pays the slayer and `cancel` refunds the poster, both `PVP_BOUNTY_WEI`.
 * `proposeClaim` does not call this.
 * `atMs` is the epoch that will contain the payment.
 */
export function admitBountyPayout(
  amountWei: bigint,
  atMs?: number,
): { ok: true; kind: "bounty"; epoch: number } | { ok: false; error: string } {
  const admitted = chainBoundXdaiSend("bounty", amountWei, atMs);
  if (!admitted.ok) return admitted;
  return { ok: true, kind: "bounty", epoch: admitted.epoch };
}

/**
 * Move a reservation into the epoch that actually paid.
 * A later empty bucket does not receive it, and it is not dropped.
 * Calling again with the same key does not add the amount twice.
 */
export function pinEpochCharge(amountWei: bigint, fromEpoch: number, paidAtMs: number, key?: string): number {
  const clockEpoch = epochIndex(readClock());
  let toEpoch = epochIndex(paidAtMs);
  if (toEpoch < fromEpoch - 1 || toEpoch > clockEpoch + 1) toEpoch = fromEpoch;
  if (key && pinnedCharges.has(key)) return toEpoch;
  if (key) pinnedCharges.add(key);
  const open = escrowCharges.find((row) => row.amount === amountWei && row.epoch === fromEpoch && !row.landed);
  if (open) open.landed = true;
  if (toEpoch === fromEpoch) {
    persistLedger();
    return toEpoch;
  }
  const held = settledByEpoch.get(fromEpoch) ?? 0n;
  if (held < amountWei) {
    persistLedger();
    return toEpoch;
  }
  subtractEpoch(fromEpoch, amountWei);
  addEpoch(toEpoch, amountWei);
  const charge = escrowCharges.find((row) => row.amount === amountWei && row.epoch === fromEpoch && row.fillKey == null);
  if (charge) charge.epoch = toEpoch;
  persistLedger();
  return toEpoch;
}

/**
 * Drop a buyAsk reservation that was not pinned to a receipt.
 * A landed fill stays in the epoch total.
 */
export function releaseEscrowReservation(amountWei: bigint, epoch: number): boolean {
  const idx = escrowCharges.findIndex((row) => row.amount === amountWei && row.epoch === epoch && !row.landed);
  if (idx < 0) return false;
  escrowCharges.splice(idx, 1);
  subtractEpoch(epoch, amountWei);
  return true;
}

/** Give back an admission that did not settle. */
export function releaseEpochXdai(amountWei: bigint, epoch: number): void {
  if (amountWei <= 0n) return;
  subtractEpoch(epoch, amountWei);
  const idx = escrowCharges.findIndex((row) => row.amount === amountWei && row.epoch === epoch && row.fillKey == null);
  if (idx >= 0) {
    escrowCharges.splice(idx, 1);
    persistLedger();
  }
}

/** In-game actions are not held for the anchor or the challenge delay. */
export function inGameWaitsForAnchor(
  _action: "play" | "movement" | "combat" | "loot" | "tick",
): false {
  return false;
}

/**
 * Hold a chain withdrawal until the certified root is posted and one day
 * has passed from that anchor. Passing `amountWei` also admits that withdrawal
 * value under the epoch cap. Omitting it does not settle xDAI. This does not
 * sign or broadcast a withdrawal.
 */
export function beginChainWithdrawal(
  amountWei?: bigint,
): { ok: true; submitted: false } | { ok: false; error: string } {
  if (amountWei == null) {
    const gate = chainBoundSendGate();
    if (!gate.ok) return gate;
    return { ok: true, submitted: false };
  }
  const admitted = chainBoundXdaiSend("withdrawal", amountWei);
  if (!admitted.ok) return admitted;
  return { ok: true, submitted: false };
}

function validBatch(batch: CertifiedBatch): boolean {
  return (
    Number.isInteger(batch.height) &&
    batch.height >= 0 &&
    batch.nextRoot instanceof Uint8Array &&
    batch.nextRoot.length === 32 &&
    batch.certificate instanceof Uint8Array &&
    batch.certificate.length > 0
  );
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}

function remember(batch: CertifiedBatch): void {
  anchored.set(batch.height, batch.nextRoot.slice());
  if (!anchoredAt.has(batch.height)) anchoredAt.set(batch.height, readClock());
  if (lastPostedHeight == null || batch.height > lastPostedHeight) {
    lastPostedHeight = batch.height;
  }
}

function chainRefused(env: NodeJS.ProcessEnv): boolean {
  const named = env.LOK_CHAIN_ID?.trim() ?? "";
  if (named === "100" || named === "10200") return true;
  if (named !== "" && named !== String(ANVIL_CHAIN_ID)) return true;
  const rpc = env.LOK_CHAIN_RPC?.trim() ?? "";
  return /gnosischain|chiado|gnosis\.gateway/i.test(rpc);
}

function normKey(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  const hex = trimmed.replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) return null;
  return hex.toLowerCase();
}

/** True when the anchor signer is missing or is an owner, private, or listing key. */
export function posterKeyRefused(env: NodeJS.ProcessEnv): boolean {
  const poster = normKey(env.LOK_ANCHOR_POSTER_KEY);
  if (!poster) return true;
  const forbidden = [env.LOK_OWNER_KEY, env.PRIVATE_KEY, env.LOK_LISTING_KEY]
    .map((key) => normKey(key))
    .filter((key): key is string => key != null);
  return forbidden.includes(poster);
}

function localAnvilRpc(rpc: string): boolean {
  return /^https?:\/\/(127\.0\.0\.1|localhost):\d+\/?$/i.test(rpc.trim());
}

/**
 * Record the batch only when the poster accepts it. A refused chain or a
 * failed post leaves `anchoredHeight` unchanged.
 */
export async function postCertifiedBatch(
  batch: CertifiedBatch,
  opts?: { env?: NodeJS.ProcessEnv; poster?: AnchorPoster },
): Promise<boolean> {
  if (!validBatch(batch)) return false;
  const env = opts?.env ?? process.env;
  if (chainRefused(env)) return false;
  const existing = anchored.get(batch.height);
  if (existing && bytesEqual(existing, batch.nextRoot)) return true;
  if (lastPostedHeight != null && batch.height <= lastPostedHeight) return false;
  if (!opts?.poster && posterKeyRefused(env)) return false;
  let ok = false;
  try {
    ok = opts?.poster ? await opts.poster(batch) : await postToLocalAnvil(batch, env);
  } catch {
    ok = false;
  }
  if (!ok) return false;
  remember(batch);
  return true;
}

/** Note the certified root, and post it when a local anchor address is set. */
export function scheduleAnchorPost(batch: CertifiedBatch, env: NodeJS.ProcessEnv = process.env): void {
  noteCertifiedBatch(batch);
  if (!env.LOK_ROOT_ANCHOR?.trim()) return;
  if (chainRefused(env)) return;
  if (posting.has(batch.height)) return;
  const existing = anchored.get(batch.height);
  if (existing && bytesEqual(existing, batch.nextRoot)) return;
  posting.add(batch.height);
  void postCertifiedBatch(batch, { env }).finally(() => {
    posting.delete(batch.height);
  });
}

async function postToLocalAnvil(batch: CertifiedBatch, env: NodeJS.ProcessEnv): Promise<boolean> {
  const address = env.LOK_ROOT_ANCHOR?.trim() ?? "";
  const rpc = env.LOK_CHAIN_RPC?.trim() ?? "";
  const key = env.LOK_ANCHOR_POSTER_KEY?.trim() ?? "";
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return false;
  if (!localAnvilRpc(rpc) || posterKeyRefused(env) || !/^0x[0-9a-fA-F]{64}$/.test(key)) return false;
  const transport = http(rpc);
  const pub = createPublicClient({ transport });
  const id = await pub.getChainId();
  if (id !== ANVIL_CHAIN_ID) return false;
  const chain = defineChain({
    id: ANVIL_CHAIN_ID,
    name: "Anvil",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpc] } },
  });
  const account = privateKeyToAccount(key as Hex);
  const wallet = createWalletClient({ account, chain, transport });
  const nextRoot = ("0x" + Buffer.from(batch.nextRoot).toString("hex")) as Hex;
  const certificate = ("0x" + Buffer.from(batch.certificate).toString("hex")) as Hex;
  const hash = await wallet.writeContract({
    address: address as Hex,
    abi: ROOT_ANCHOR_ABI,
    functionName: "post",
    args: [BigInt(batch.height), nextRoot, certificate],
    account,
    chain,
  });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") return false;
  return pub.readContract({
    address: address as Hex,
    abi: ROOT_ANCHOR_ABI,
    functionName: "isAnchored",
    args: [BigInt(batch.height), nextRoot],
  });
}

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
 * `withdrawKek` and bag export are not chain withdrawals. `beginChainWithdrawal`
 * is the hold those sends must pass, and it does not broadcast.
 */
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  parseAbi,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

export const ANCHOR_WAIT = "Waiting for an anchored root.";

/** One day. Same floor as `RulesetRegistry.MIN_DELAY`. Not `PvpBounty.claimDelay`. */
export const CHALLENGE_DELAY_MS = 24 * 60 * 60 * 1000;

export const CHALLENGE_WAIT = "Waiting for the one-day challenge delay.";

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
  certified = null;
  anchored = new Map();
  anchoredAt = new Map();
  lastPostedHeight = null;
  posting.clear();
  readClock = () => Date.now();
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

/** In-game actions are not held for the anchor or the challenge delay. */
export function inGameWaitsForAnchor(
  _action: "play" | "movement" | "combat" | "loot" | "tick",
): false {
  return false;
}

/**
 * Hold a chain withdrawal until the certified root is posted and one day
 * has passed from that anchor. This does not sign or broadcast a withdrawal.
 */
export function beginChainWithdrawal():
  | { ok: true; submitted: false }
  | { ok: false; error: string } {
  const gate = chainBoundSendGate();
  if (!gate.ok) return gate;
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

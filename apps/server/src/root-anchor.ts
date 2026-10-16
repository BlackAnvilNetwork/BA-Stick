/**
 * Post a certified lok-order batch to the local root anchor.
 *
 * A batch is anchored only after `post` succeeds. A status line that claims
 * an anchored height does not count. Gnosis mainnet (100) and Chiado (10200)
 * are refused. The listing key is not read. Combat, movement, loot, and the
 * 20 Hz tick do not call this module.
 *
 * There is no withdrawal broadcast on the server. `withdrawKek` and bag export
 * do not send a transaction, so they have nothing to hold.
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
let lastPostedHeight: number | null = null;
const posting = new Set<number>();

export function resetRootAnchorForTests(): void {
  certified = null;
  anchored = new Map();
  lastPostedHeight = null;
  posting.clear();
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
 * when that exact root has been posted.
 */
export function chainBoundSendGate(): { ok: true } | { ok: false; error: string } {
  if (!certified) return { ok: false, error: ANCHOR_WAIT };
  const posted = anchored.get(certified.height);
  if (!posted || !bytesEqual(posted, certified.nextRoot)) {
    return { ok: false, error: ANCHOR_WAIT };
  }
  return { ok: true };
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
  const key = env.LOK_OWNER_KEY?.trim() ?? "";
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return false;
  if (!rpc || !/^0x[0-9a-fA-F]{64}$/.test(key)) return false;
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

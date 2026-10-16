/**
 * On-chain PvpBounty txs — operator claim/cancel via listing/owner key;
 * read helpers for open status + receipt fields for log mirrors.
 */
import { join } from "node:path";
import { ASH_PIT, PVP_BOUNTY_WEI } from "@bellgrave/config";
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  http,
  type Chain,
  type Hex,
  type Log,
  type TransactionReceipt,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { listingRoleKey } from "./ah-escrow";
import { opsAlert } from "./ops-log";
import { withOwnerKeyQueue } from "./owner-tx-queue";
import type { LokResult } from "./lok-world";
import { pvpBountyAddress, pvpSyntheticReceiptsAllowed } from "./pvp-bounty";
import { settlementChainId } from "./settlement-chain";
import { settlementConfirmations } from "./settlement-confirmations";
import { admitBountyPayout, chainBoundSendGate, pinEpochCharge, releaseEpochXdai } from "./root-anchor";
import { watcherStartBlock } from "./settlement-rpc";
import { readWatcherCursor, writeWatcherCursor } from "./watcher-cursor";

export const PVP_BOUNTY_ABI = [
  {
    type: "function",
    name: "place",
    stateMutability: "payable",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "cancel",
    stateMutability: "nonpayable",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "proposeClaim",
    stateMutability: "nonpayable",
    inputs: [
      { name: "victimTokenId", type: "uint256" },
      { name: "slayerTokenId", type: "uint256" },
      { name: "expectedSlayer", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "executeClaim",
    stateMutability: "nonpayable",
    inputs: [{ name: "victimTokenId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "claimDelay",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "payerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "open",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "BOUNTY_WEI",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "event",
    name: "BountyOpened",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "payer", type: "address", indexed: true },
      { name: "amountWei", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "BountyCancelled",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "refundTo", type: "address", indexed: true },
      { name: "amountWei", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "BountyClaimed",
    inputs: [
      { name: "victimTokenId", type: "uint256", indexed: true },
      { name: "slayerTokenId", type: "uint256", indexed: true },
      { name: "slayerPayout", type: "address", indexed: true },
      { name: "amountWei", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ClaimProposed",
    inputs: [
      { name: "victimTokenId", type: "uint256", indexed: true },
      { name: "slayerTokenId", type: "uint256", indexed: true },
      { name: "payout", type: "address", indexed: true },
      { name: "readyAt", type: "uint64", indexed: false },
    ],
  },
] as const;

const OWNER_OF_ABI = [
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
] as const;

export type PvpChainReceipt = {
  txHash: `0x${string}`;
  logIndex: number;
};

function rpcUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  const u = (env.LOK_CHAIN_RPC?.trim() || env.LOK_PUBLIC_RPC?.trim() || "").replace(/\/$/, "");
  return u || null;
}

function operatorKey(env: NodeJS.ProcessEnv = process.env): string | null {
  // OPERATOR = LISTING on Deploy / DeployPvpBountyGnosis. Require LOK_LISTING_KEY —
  // never fall back to LOK_OWNER_KEY / PRIVATE_KEY (admin must not live on the server).
  const listing = env.LOK_LISTING_KEY?.trim() || "";
  if (/^0x[0-9a-fA-F]{64}$/.test(listing)) return listing;
  return listingRoleKey(env);
}

function anvilChain(chainId: number): Chain {
  return {
    id: chainId,
    name: chainId === 31337 ? "anvil" : "lok",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl() || "http://127.0.0.1:8545"] } },
  };
}

export async function readPvpBountyOpen(
  tokenId: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<boolean | null> {
  const bounty = pvpBountyAddress(env);
  const rpc = rpcUrl(env);
  if (!bounty || !rpc) return null;
  const client = createPublicClient({
    chain: anvilChain(settlementChainId(env)),
    transport: http(rpc),
  });
  try {
    return await client.readContract({
      address: bounty as Hex,
      abi: PVP_BOUNTY_ABI,
      functionName: "open",
      args: [BigInt(tokenId)],
    });
  } catch {
    return null;
  }
}

function eventReceipt(
  receipt: TransactionReceipt,
  eventName: "BountyOpened" | "BountyCancelled" | "BountyClaimed" | "ClaimProposed",
): PvpChainReceipt | null {
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: PVP_BOUNTY_ABI,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === eventName) {
        return {
          txHash: receipt.transactionHash,
          logIndex: Number(log.logIndex),
        };
      }
    } catch {
      /* not our event */
    }
  }
  return null;
}

async function withOperatorWallet<T>(
  env: NodeJS.ProcessEnv,
  fn: (ctx: {
    wallet: ReturnType<typeof createWalletClient>;
    public: ReturnType<typeof createPublicClient>;
    account: ReturnType<typeof privateKeyToAccount>;
    bounty: Hex;
  }) => Promise<T>,
): Promise<T> {
  const bounty = pvpBountyAddress(env);
  const rpc = rpcUrl(env);
  const key = operatorKey(env);
  if (!bounty || !rpc || !key) {
    throw new Error("PvpBounty needs LOK_PVP_BOUNTY + LOK_CHAIN_RPC + LOK_LISTING_KEY");
  }
  const account = privateKeyToAccount(key as Hex);
  const chain = anvilChain(settlementChainId(env));
  const publicClient = createPublicClient({ chain, transport: http(rpc) });
  const wallet = createWalletClient({ account, chain, transport: http(rpc) });
  return fn({ wallet, public: publicClient, account, bounty: bounty as Hex });
}

/**
 * Operator cancel — refunds the original payer `PVP_BOUNTY_WEI` (1 xDAI).
 * The refund is not broadcast unless this epoch admits that xDAI.
 * Zero posted bonds admit nothing.
 */
export async function chainPvpCancel(
  tokenId: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ ok: true; receipt: PvpChainReceipt } | { ok: false; error: string }> {
  const bountyWei = BigInt(PVP_BOUNTY_WEI);
  const admitted = admitBountyPayout(bountyWei);
  if (!admitted.ok) return admitted;
  let holding = true;
  const release = () => {
    if (!holding) return;
    holding = false;
    releaseEpochXdai(bountyWei, admitted.epoch);
  };
  try {
    return await withOwnerKeyQueue(async () => {
      return withOperatorWallet(env, async ({ wallet, public: pub, account, bounty }) => {
        let broadcast = false;
        try {
          const hash = await wallet.writeContract({
            address: bounty,
            abi: PVP_BOUNTY_ABI,
            functionName: "cancel",
            args: [BigInt(tokenId)],
            account,
            chain: wallet.chain,
          });
          broadcast = true;
          const conf = Number(settlementConfirmations(env));
          const receipt = await pub.waitForTransactionReceipt({
            hash,
            confirmations: conf >= 1 ? conf : 1,
          });
          if (receipt.status !== "success") {
            release();
            return { ok: false, error: "PvpBounty.cancel reverted" };
          }
          const fields = eventReceipt(receipt, "BountyCancelled");
          if (!fields) {
            release();
            return { ok: false, error: "PvpBounty.cancel missing event" };
          }
          const paidAt = await blockPaidAtMs(pub, receipt.blockNumber);
          if (paidAt != null) pinEpochCharge(bountyWei, admitted.epoch, paidAt, hash);
          holding = false;
          return { ok: true, receipt: fields };
        } catch (err) {
          if (!broadcast) release();
          throw err;
        }
      });
    });
  } catch (err) {
    release();
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function readCharacterOwner(
  tokenId: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string | null> {
  const nft = env.LOK_NFT?.trim();
  const rpc = rpcUrl(env);
  if (!nft || !rpc || !/^0x[0-9a-fA-F]{40}$/.test(nft)) return null;
  const client = createPublicClient({
    chain: anvilChain(settlementChainId(env)),
    transport: http(rpc),
  });
  try {
    const owner = await client.readContract({
      address: nft as Hex,
      abi: OWNER_OF_ABI,
      functionName: "ownerOf",
      args: [BigInt(tokenId)],
    });
    return owner.toLowerCase();
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function blockPaidAtMs(
  pub: {
    getBlock: (args: { blockNumber: bigint } | { blockTag: "latest" }) => Promise<{ timestamp: bigint }>;
  },
  block: bigint | "latest",
): Promise<number | undefined> {
  try {
    const found =
      block === "latest"
        ? await pub.getBlock({ blockTag: "latest" })
        : await pub.getBlock({ blockNumber: block });
    return Number(found.timestamp) * 1000;
  } catch {
    return undefined;
  }
}

/**
 * Operator claim. proposeClaim snapshots `expectedSlayer` (must be ownerOf now).
 * executeClaim pays that address after claimDelay, not a later NFT owner.
 * The payout is admitted in the epoch where executeClaim pays, and refused
 * when that epoch would pass 10% of the slashable bonds posted then.
 */
export async function chainPvpClaim(
  victimTokenId: string,
  slayerTokenId: string,
  expectedSlayer: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ ok: true; receipt: PvpChainReceipt } | { ok: false; error: string }> {
  if (!/^0x[0-9a-fA-F]{40}$/.test(expectedSlayer)) {
    return { ok: false, error: "Slayer wallet is not an address." };
  }
  const gate = chainBoundSendGate();
  if (!gate.ok) return gate;
  const bountyWei = BigInt(PVP_BOUNTY_WEI);
  const owner = await readCharacterOwner(slayerTokenId, env);
  if (!owner || owner !== expectedSlayer.toLowerCase()) {
    return {
      ok: false,
      error: "Slayer no longer owns that character — bounty will be refunded, not paid to the new owner.",
    };
  }
  try {
    return await withOwnerKeyQueue<
      { ok: true; receipt: PvpChainReceipt } | { ok: false; error: string }
    >(async () => {
      return withOperatorWallet(env, async ({ wallet, public: pub, account, bounty }) => {
        const delay = await pub.readContract({
          address: bounty,
          abi: PVP_BOUNTY_ABI,
          functionName: "claimDelay",
        });
        opsAlert({
          level: "warn",
          event: "pvp_bounty_claim_proposed",
          msg:
            "PvpBounty proposeClaim victim=" +
            victimTokenId +
            " slayer=" +
            slayerTokenId +
            " payout=" +
            expectedSlayer.toLowerCase() +
            " delaySec=" +
            delay.toString(),
          dedupeKey: "pvp-propose-" + victimTokenId,
        });
        const proposedHash = await wallet.writeContract({
          address: bounty,
          abi: PVP_BOUNTY_ABI,
          functionName: "proposeClaim",
          args: [BigInt(victimTokenId), BigInt(slayerTokenId), expectedSlayer as Hex],
          account,
          chain: wallet.chain,
        });
        const conf = Number(settlementConfirmations(env));
        const proposed = await pub.waitForTransactionReceipt({
          hash: proposedHash,
          confirmations: conf >= 1 ? conf : 1,
        });
        if (proposed.status !== "success") return { ok: false, error: "PvpBounty.proposeClaim reverted" };
        if (!eventReceipt(proposed, "ClaimProposed")) {
          return { ok: false, error: "PvpBounty.proposeClaim missing ClaimProposed" };
        }
        if (delay > 0n) {
          const waitMs = Number(delay) * 1000 + 1500;
          if (!Number.isFinite(waitMs) || waitMs > 7 * 24 * 60 * 60 * 1000) {
            return { ok: false, error: "PvpBounty claimDelay is too long to wait in-process." };
          }
          await sleep(waitMs);
        }
        const predictAt = await blockPaidAtMs(pub, "latest");
        const admitted = admitBountyPayout(bountyWei, predictAt);
        if (!admitted.ok) return admitted;
        let chargedEpoch = admitted.epoch;
        let landed = false;
        const release = () => releaseEpochXdai(bountyWei, chargedEpoch);
        try {
          const hash = await wallet.writeContract({
            address: bounty,
            abi: PVP_BOUNTY_ABI,
            functionName: "executeClaim",
            args: [BigInt(victimTokenId)],
            account,
            chain: wallet.chain,
          });
          const receipt = await pub.waitForTransactionReceipt({
            hash,
            confirmations: conf >= 1 ? conf : 1,
          });
          if (receipt.status !== "success") {
            release();
            return { ok: false, error: "PvpBounty.executeClaim reverted" };
          }
          const fields = eventReceipt(receipt, "BountyClaimed");
          if (!fields) {
            release();
            return { ok: false, error: "PvpBounty.executeClaim missing BountyClaimed" };
          }
          const paidAt = await blockPaidAtMs(pub, receipt.blockNumber);
          if (paidAt != null) chargedEpoch = pinEpochCharge(bountyWei, admitted.epoch, paidAt, hash);
          landed = true;
          opsAlert({
            level: "alert",
            event: "pvp_bounty_claimed",
            msg:
              "PvpBounty claimed victim=" +
              victimTokenId +
              " slayer=" +
              slayerTokenId +
              " payout=" +
              expectedSlayer.toLowerCase() +
              " tx=" +
              fields.txHash,
            dedupeKey: "pvp-claim-" + fields.txHash,
          });
          return { ok: true, receipt: fields };
        } catch (err) {
          if (!landed) release();
          throw err;
        }
      });
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Load place tx receipt fields after the player paid on-chain. */
export async function receiptFromPlaceTx(
  txHash: string,
  tokenId: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ ok: true; receipt: PvpChainReceipt } | { ok: false; error: string }> {
  const bounty = pvpBountyAddress(env);
  const rpc = rpcUrl(env);
  if (!bounty || !rpc) return { ok: false, error: "PvpBounty not configured" };
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) return { ok: false, error: "Bad place tx hash" };
  try {
    const pub = createPublicClient({
      chain: anvilChain(settlementChainId(env)),
      transport: http(rpc),
    });
    const conf = Number(settlementConfirmations(env));
    const receipt = await pub.waitForTransactionReceipt({
      hash: txHash as Hex,
      confirmations: conf >= 1 ? conf : 1,
    });
    if (receipt.status !== "success") return { ok: false, error: "place tx reverted" };
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== bounty.toLowerCase()) continue;
      try {
        const decoded = decodeEventLog({
          abi: PVP_BOUNTY_ABI,
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName === "BountyOpened") {
          const tid = (decoded.args as { tokenId: bigint }).tokenId;
          if (tid.toString() !== tokenId) {
            return { ok: false, error: "place tx is for a different character" };
          }
          return {
            ok: true,
            receipt: { txHash: receipt.transactionHash, logIndex: Number(log.logIndex) },
          };
        }
      } catch {
        /* skip */
      }
    }
    return { ok: false, error: "place tx has no BountyOpened log for this character" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Recover the BountyOpened receipt when the bounty is already open on-chain
 * (client lost the place hash, or server restarted mid-join).
 */
export async function receiptFromOpenBounty(
  tokenId: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ ok: true; receipt: PvpChainReceipt } | { ok: false; error: string }> {
  const bounty = pvpBountyAddress(env);
  const rpc = rpcUrl(env);
  if (!bounty || !rpc) return { ok: false, error: "PvpBounty not configured" };
  try {
    const pub = createPublicClient({
      chain: anvilChain(settlementChainId(env)),
      transport: http(rpc),
    });
    const open = await pub.readContract({
      address: bounty as Hex,
      abi: PVP_BOUNTY_ABI,
      functionName: "open",
      args: [BigInt(tokenId)],
    });
    if (!open) return { ok: false, error: "No open bounty on-chain for this character" };
    const logs = await pub.getLogs({
      address: bounty as Hex,
      event: {
        type: "event",
        name: "BountyOpened",
        inputs: [
          { name: "tokenId", type: "uint256", indexed: true },
          { name: "payer", type: "address", indexed: true },
          { name: "amountWei", type: "uint256", indexed: false },
        ],
      },
      args: { tokenId: BigInt(tokenId) },
      fromBlock: 0n,
      toBlock: "latest",
    });
    const last = logs[logs.length - 1];
    if (!last?.transactionHash) {
      return { ok: false, error: "Open bounty has no BountyOpened log — re-place or contact ops" };
    }
    return {
      ok: true,
      receipt: {
        txHash: last.transactionHash,
        logIndex: Number(last.logIndex ?? 0),
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

type PvpMirror = {
  pvpBountyOf(tokenId: string): { areaId: string } | undefined;
  pvpBountyOpen(
    tokenId: string,
    amountWei: string,
    areaId: string,
    txHash: string,
    logIndex: number,
  ): LokResult;
  pvpBountyCancel(tokenId: string, areaId: string, txHash: string, logIndex: number): LokResult;
  pvpKill(
    victim: string,
    slayer: string,
    areaId: string,
    amountWei: string,
    txHash: string,
    logIndex: number,
  ): LokResult;
};

function mirrorPvpLog(lok: PvpMirror, log: Log): void {
  if (log.transactionHash == null || log.logIndex == null) return;
  let decoded: ReturnType<typeof decodeEventLog>;
  try {
    decoded = decodeEventLog({ abi: PVP_BOUNTY_ABI, data: log.data, topics: log.topics });
  } catch {
    return;
  }
  const txHash = log.transactionHash;
  const logIndex = Number(log.logIndex);
  const areaOf = (tokenId: string) => lok.pvpBountyOf(tokenId)?.areaId ?? ASH_PIT.id;
  if (decoded.eventName === "BountyOpened") {
    const args = decoded.args as { tokenId: bigint; amountWei: bigint };
    if (args.amountWei.toString() !== PVP_BOUNTY_WEI) return;
    const res = lok.pvpBountyOpen(args.tokenId.toString(), args.amountWei.toString(), ASH_PIT.id, txHash, logIndex);
    if (!res.ok && res.error !== "pvp receipt already mirrored") {
      console.error("[bellgrave] PvpBounty open mirror: " + res.error);
    }
    return;
  }
  if (decoded.eventName === "BountyCancelled") {
    const tokenId = (decoded.args as { tokenId: bigint }).tokenId.toString();
    const res = lok.pvpBountyCancel(tokenId, areaOf(tokenId), txHash, logIndex);
    if (!res.ok && res.error !== "pvp receipt already mirrored" && res.error !== "no open pvp bounty") {
      console.error("[bellgrave] PvpBounty cancel mirror: " + res.error);
    }
    return;
  }
  if (decoded.eventName === "BountyClaimed") {
    const args = decoded.args as { victimTokenId: bigint; slayerTokenId: bigint; amountWei: bigint };
    if (args.amountWei.toString() !== PVP_BOUNTY_WEI) return;
    const victim = args.victimTokenId.toString();
    const res = lok.pvpKill(
      victim,
      args.slayerTokenId.toString(),
      areaOf(victim),
      args.amountWei.toString(),
      txHash,
      logIndex,
    );
    if (!res.ok && res.error !== "pvp receipt already mirrored" && res.error !== "no open pvp bounty") {
      console.error("[bellgrave] PvpBounty claim mirror: " + res.error);
    }
  }
}

/** Backfill verified PvpBounty logs into the character log. Same idea as the AhEscrow fill watcher. */
export function startPvpBountyWatcher(
  lok: PvpMirror,
  opts?: { dataDir?: string; env?: NodeJS.ProcessEnv },
): void {
  const env = opts?.env ?? process.env;
  const bounty = pvpBountyAddress(env);
  const rpc = rpcUrl(env);
  if (!bounty || !rpc || pvpSyntheticReceiptsAllowed(env)) return;
  const chainId = settlementChainId(env);
  const confirmations = BigInt(Math.max(1, Number(settlementConfirmations(env)) || 1));
  const cursorPath = join(opts?.dataDir ?? ".", "pvp-bounty-watcher-cursor.json");
  const start = watcherStartBlock(env);
  let cursor = readWatcherCursor({
    path: cursorPath,
    expectedChainId: chainId,
    expectedAddress: bounty,
    fallback: start > 0n ? start - 1n : 0n,
  });
  const client = createPublicClient({ chain: anvilChain(chainId), transport: http(rpc) });
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      const tip = await client.getBlockNumber();
      const safe = tip > confirmations ? tip - confirmations : 0n;
      if (safe <= cursor) return;
      const to = safe - cursor > 2000n ? cursor + 2000n : safe;
      const logs = await client.getLogs({
        address: bounty as Hex,
        fromBlock: cursor + 1n,
        toBlock: to,
      });
      logs.sort(
        (a, b) =>
          Number((a.blockNumber ?? 0n) - (b.blockNumber ?? 0n)) ||
          Number((a.logIndex ?? 0) - (b.logIndex ?? 0)),
      );
      for (const log of logs) {
        if (log.address.toLowerCase() !== bounty.toLowerCase()) continue;
        mirrorPvpLog(lok, log);
      }
      cursor = to;
      writeWatcherCursor({ path: cursorPath, cursor, chainId, address: bounty });
    } catch (err) {
      console.error("[bellgrave] PvpBounty watcher: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      busy = false;
    }
  };
  console.log("[bellgrave] PvpBounty watcher bounty=" + bounty + " from=" + cursor.toString());
  void tick();
  setInterval(() => void tick(), 12_000);
}

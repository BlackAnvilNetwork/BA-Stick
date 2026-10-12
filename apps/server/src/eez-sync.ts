/**
 * EEZ sync-buy config + local mock wiring.
 *
 * Production path: home-chain payment → EEZ CrossChainProxy → AhEscrow.buyAsk{value}.
 * Local path: MockEezSyncBuy.syncBuy{value} on the game chain (same seller payout
 * batch inside AhEscrow). Opt-in via LOK_EEZ_SYNC_BUY=1. Mock path is gated to
 * chain 31337 + localhost RPC, and the mock must have code pointing at our escrow.
 */
import {
  createPublicClient,
  http,
  type Hex,
} from "viem";
import type { EezSyncBuyClientConfig } from "@bellgrave/protocol";
import { ahEscrowAddress, ahEscrowClientConfig } from "./ah-escrow";

export type { EezSyncBuyClientConfig };

export type EezZoneConfig = {
  /** EEZ rollup / zone id once registered (or local mock zone). */
  zoneId: string | null;
  /** Home-chain RPC the client may use for sync value. */
  homeRpcUrl: string | null;
  homeChainId: number | null;
  homeLabel: string | null;
  /** Local MockEezSyncBuy when testing without a live EEZ zone. */
  mockSyncBuy: string | null;
  /** Structurally enabled (env + local gate). On-chain verify is separate. */
  syncBuyEnabled: boolean;
};

const MOCK_ESCROW_ABI = [
  {
    type: "function",
    name: "escrow",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
] as const;

function parseChainId(raw: string | undefined, fallback: number | null): number | null {
  const t = raw?.trim();
  if (!t) return fallback;
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function isLocalAnvilRpc(rpc: string): boolean {
  try {
    const u = new URL(rpc);
    return u.hostname === "127.0.0.1" || u.hostname === "localhost" || u.hostname === "0.0.0.0";
  } catch {
    return false;
  }
}

/** M-D: mock EEZ only on local anvil 31337. */
export function eezLocalGateOk(env: NodeJS.ProcessEnv = process.env): boolean {
  const game = ahEscrowClientConfig(env);
  const chainId = parseChainId(env.LOK_CHAIN_ID, game?.chainId ?? null);
  if (chainId !== 31337) return false;
  const rpc = (env.LOK_PUBLIC_RPC?.trim() || env.LOK_CHAIN_RPC?.trim() || game?.rpcUrl || "").replace(
    /\/$/,
    "",
  );
  return !!rpc && isLocalAnvilRpc(rpc);
}

export function eezZoneConfig(env: NodeJS.ProcessEnv = process.env): EezZoneConfig {
  const zoneId = env.LOK_EEZ_ZONE_ID?.trim() || null;
  const homeRpcUrl = env.LOK_EEZ_HOME_RPC?.trim() || null;
  const mockSyncBuy = env.LOK_EEZ_MOCK_SYNC_BUY?.trim() || null;
  const mockOk = !!(mockSyncBuy && /^0x[0-9a-fA-F]{40}$/.test(mockSyncBuy));
  const game = ahEscrowClientConfig(env);
  const localOk = eezLocalGateOk(env);
  const homeChainId = parseChainId(
    env.LOK_EEZ_HOME_CHAIN_ID,
    mockOk && game && localOk ? game.chainId : null,
  );
  const homeLabel = env.LOK_EEZ_HOME_LABEL?.trim() || (mockOk && localOk ? "Local anvil (mock EEZ)" : null);
  const syncBuyEnabled =
    env.LOK_EEZ_SYNC_BUY === "1" &&
    !!zoneId &&
    !!ahEscrowAddress(env) &&
    localOk &&
    mockOk &&
    homeChainId === 31337;
  return {
    zoneId,
    homeRpcUrl: homeRpcUrl || (mockOk && game && localOk ? game.rpcUrl : null),
    homeChainId: syncBuyEnabled ? homeChainId : homeChainId,
    homeLabel,
    mockSyncBuy: mockOk ? mockSyncBuy!.toLowerCase() : null,
    syncBuyEnabled,
  };
}

/**
 * Confirm MockEezSyncBuy has code and `escrow()` equals LOK_AH_ESCROW (M-D).
 */
export async function verifyEezMockOnchain(
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ ok: true; mock: string; escrow: string } | { ok: false; error: string }> {
  const z = eezZoneConfig(env);
  if (!z.syncBuyEnabled || !z.mockSyncBuy || !z.homeRpcUrl || z.homeChainId == null) {
    return { ok: false, error: "EEZ mock path is not structurally enabled." };
  }
  const escrow = ahEscrowAddress(env);
  if (!escrow) return { ok: false, error: "AhEscrow is not configured." };
  try {
    const pub = createPublicClient({
      transport: http(z.homeRpcUrl),
      chain: {
        id: z.homeChainId,
        name: "Bellgrave Anvil",
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        rpcUrls: { default: { http: [z.homeRpcUrl] } },
      },
    });
    const code = await pub.getBytecode({ address: z.mockSyncBuy as Hex });
    if (!code || code === "0x") {
      return { ok: false, error: "MockEezSyncBuy has no code at " + z.mockSyncBuy };
    }
    const pointed = (
      await pub.readContract({
        address: z.mockSyncBuy as Hex,
        abi: MOCK_ESCROW_ABI,
        functionName: "escrow",
      })
    ).toLowerCase();
    if (pointed !== escrow.toLowerCase()) {
      return {
        ok: false,
        error: "MockEezSyncBuy.escrow is " + pointed + ", expected " + escrow.toLowerCase(),
      };
    }
    return { ok: true, mock: z.mockSyncBuy, escrow: escrow.toLowerCase() };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Sync snapshot helper — does not prove on-chain wiring. Prefer loadEezClientConfig at boot. */
export function eezClientConfig(env: NodeJS.ProcessEnv = process.env): EezSyncBuyClientConfig | null {
  const z = eezZoneConfig(env);
  if (!z.syncBuyEnabled && !z.zoneId && !z.mockSyncBuy) return null;
  const game = ahEscrowClientConfig(env);
  return {
    syncBuyEnabled: z.syncBuyEnabled,
    zoneId: z.zoneId,
    homeChainId: z.homeChainId,
    homeRpcUrl: z.homeRpcUrl,
    homeLabel: z.homeLabel,
    mockSyncBuy: z.mockSyncBuy,
    gameEscrow: game?.address ?? ahEscrowAddress(env),
    gameChainId: game?.chainId ?? null,
  };
}

/** Boot: only expose sync buy after local gate + on-chain mock verify. */
export async function loadEezClientConfig(
  env: NodeJS.ProcessEnv = process.env,
): Promise<EezSyncBuyClientConfig | null> {
  const base = eezClientConfig(env);
  if (!base?.syncBuyEnabled) {
    return base && (base.zoneId || base.mockSyncBuy) ? { ...base, syncBuyEnabled: false } : null;
  }
  const verified = await verifyEezMockOnchain(env);
  if (!verified.ok) {
    console.warn("[bellgrave] EEZ mock verify failed — sync buy stays disabled: " + verified.error);
    return { ...base, syncBuyEnabled: false };
  }
  return base;
}

export type EezSyncBuyPlan =
  | {
      ok: true;
      mode: "local-mock";
      zoneId: string;
      mockAddress: string;
      homeChainId: number;
      homeRpcUrl: string;
      gameEscrow: string;
      listingId: string;
      priceWei: string;
      buyerTokenId: string;
      /** Seller payout is already same-tx inside AhEscrow.buyAsk. */
      sellerPayoutSameBatch: true;
    }
  | { ok: false; error: string };

/**
 * Map a home-chain payment intent to a local MockEezSyncBuy call (or refuse).
 * Live EEZ CrossChainProxy registration is out of band; local tests use the mock.
 */
export function planEezSyncBuy(
  opts: {
    listingId: string;
    priceWei: string;
    buyerTokenId: string;
    homeChainId: number;
  },
  env: NodeJS.ProcessEnv = process.env,
): EezSyncBuyPlan {
  const z = eezZoneConfig(env);
  if (!z.syncBuyEnabled || !z.zoneId) {
    return {
      ok: false,
      error:
        "EEZ sync buy is not enabled. Set LOK_EEZ_SYNC_BUY=1, LOK_EEZ_ZONE_ID, and " +
        "LOK_EEZ_MOCK_SYNC_BUY on local anvil 31337.",
    };
  }
  if (!eezLocalGateOk(env)) {
    return { ok: false, error: "EEZ mock sync buy is only available on local chain 31337." };
  }
  if (!/^[1-9][0-9]{0,77}$/.test(opts.listingId) || !/^[1-9][0-9]{0,77}$/.test(opts.buyerTokenId)) {
    return { ok: false, error: "Bad listing or buyer token id." };
  }
  let price: bigint;
  try {
    price = BigInt(opts.priceWei);
  } catch {
    return { ok: false, error: "Bad ask price." };
  }
  if (price <= 0n) return { ok: false, error: "Ask price must be greater than 0." };
  if (z.homeChainId != null && opts.homeChainId !== z.homeChainId) {
    return {
      ok: false,
      error: "Home chain " + opts.homeChainId + " is not configured (expected " + z.homeChainId + ").",
    };
  }
  if (!z.mockSyncBuy || !z.homeRpcUrl || z.homeChainId == null) {
    return {
      ok: false,
      error:
        "EEZ sync buy needs LOK_EEZ_MOCK_SYNC_BUY + home RPC/chain for local testing. " +
        "Live CrossChainProxy registration is not wired in this build.",
    };
  }
  const escrow = ahEscrowAddress(env);
  if (!escrow) return { ok: false, error: "AhEscrow is not configured." };
  return {
    ok: true,
    mode: "local-mock",
    zoneId: z.zoneId,
    mockAddress: z.mockSyncBuy,
    homeChainId: z.homeChainId,
    homeRpcUrl: z.homeRpcUrl,
    gameEscrow: escrow,
    listingId: opts.listingId,
    priceWei: opts.priceWei,
    buyerTokenId: opts.buyerTokenId,
    sellerPayoutSameBatch: true,
  };
}

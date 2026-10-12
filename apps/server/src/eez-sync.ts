/**
 * EEZ sync-buy config + local mock wiring.
 *
 * Production path: home-chain payment → EEZ CrossChainProxy → AhEscrow.buyAsk{value}.
 * Local path: MockEezSyncBuy.syncBuy{value} on the game chain (same seller payout
 * batch inside AhEscrow). Opt-in via LOK_EEZ_SYNC_BUY=1.
 */
import type { EezSyncBuyClientConfig } from "@bellgrave/protocol";
import { ahEscrowAddress, ahEscrowClientConfig } from "./ah-escrow";

export type EezZoneConfig = {
  /** EEZ rollup / zone id once registered (or local mock zone). */
  zoneId: string | null;
  /** Home-chain RPC the client may use for sync value. */
  homeRpcUrl: string | null;
  homeChainId: number | null;
  homeLabel: string | null;
  /** Local MockEezSyncBuy when testing without a live EEZ zone. */
  mockSyncBuy: string | null;
  /** Game-chain AhEscrow already configured separately via LOK_AH_ESCROW. */
  syncBuyEnabled: boolean;
};

function parseChainId(raw: string | undefined, fallback: number | null): number | null {
  const t = raw?.trim();
  if (!t) return fallback;
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export function eezZoneConfig(env: NodeJS.ProcessEnv = process.env): EezZoneConfig {
  const zoneId = env.LOK_EEZ_ZONE_ID?.trim() || null;
  const homeRpcUrl = env.LOK_EEZ_HOME_RPC?.trim() || null;
  const mockSyncBuy = env.LOK_EEZ_MOCK_SYNC_BUY?.trim() || null;
  const mockOk = !!(mockSyncBuy && /^0x[0-9a-fA-F]{40}$/.test(mockSyncBuy));
  const game = ahEscrowClientConfig(env);
  const homeChainId = parseChainId(
    env.LOK_EEZ_HOME_CHAIN_ID,
    // Local mock defaults home = game chain (same anvil) for end-to-end tests.
    mockOk && game ? game.chainId : null,
  );
  const homeLabel = env.LOK_EEZ_HOME_LABEL?.trim() || (mockOk ? "Local anvil (mock EEZ)" : null);
  const syncBuyEnabled =
    env.LOK_EEZ_SYNC_BUY === "1" && !!zoneId && !!ahEscrowAddress(env) && (mockOk || !!homeRpcUrl);
  return {
    zoneId,
    homeRpcUrl: homeRpcUrl || (mockOk && game ? game.rpcUrl : null),
    homeChainId,
    homeLabel,
    mockSyncBuy: mockOk ? mockSyncBuy!.toLowerCase() : null,
    syncBuyEnabled,
  };
}

/** Snapshot / auth payload for the client home-chain picker. */
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
        "LOK_EEZ_MOCK_SYNC_BUY (local) or LOK_EEZ_HOME_RPC.",
    };
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

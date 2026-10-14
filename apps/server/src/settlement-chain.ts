/**
 * Settlement chain id for currency labels / AhEscrow client config.
 * Prefer eth_chainId from LOK_CHAIN_RPC (TTL-cached); fall back to LOK_CHAIN_ID.
 * Hard-fail on mismatch when LOK_CHAIN_ID_STRICT is set.
 */
import { settlementCurrency } from "@bellgrave/config";

/** Cache TTL in milliseconds (default 5 minutes). */
const CHAIN_ID_CACHE_TTL_MS = 5 * 60 * 1000;

let cachedRpcChainId: number | null = null;
let cacheExpiresAt = 0;

export function envSettlementChainId(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.LOK_CHAIN_ID?.trim() || "31337";
  if (!/^\d+$/.test(raw)) return 31337;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : 31337;
}

/** Last RPC-resolved chain id, or null if never refreshed / expired. */
export function cachedSettlementChainId(): number | null {
  if (Date.now() > cacheExpiresAt) return null;
  return cachedRpcChainId;
}

/** Test helper — clear / inject the RPC cache. */
export function setCachedSettlementChainId(id: number | null, ttlMs = CHAIN_ID_CACHE_TTL_MS): void {
  cachedRpcChainId = id;
  cacheExpiresAt = id !== null ? Date.now() + ttlMs : 0;
}

/**
 * Effective settlement chain: RPC cache when present and valid, else LOK_CHAIN_ID / 31337.
 * Call `refreshSettlementChainIdFromRpc` at boot so labels match mint config.
 */
export function settlementChainId(env: NodeJS.ProcessEnv = process.env): number {
  if (Date.now() <= cacheExpiresAt && cachedRpcChainId !== null) {
    return cachedRpcChainId;
  }
  return envSettlementChainId(env);
}

export function settlementUnitSymbol(env: NodeJS.ProcessEnv = process.env): string {
  return settlementCurrency(settlementChainId(env)).symbol;
}

export function settlementExampleAskHuman(env: NodeJS.ProcessEnv = process.env): string {
  return settlementCurrency(settlementChainId(env)).exampleAskHuman;
}

async function ethChainId(rpc: string): Promise<number> {
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
  });
  const body = (await res.json()) as { result?: string; error?: { message?: string } };
  if (body.error) throw new Error(body.error.message || "rpc error");
  const hex = body.result;
  if (typeof hex !== "string" || !/^0x[0-9a-fA-F]+$/.test(hex)) {
    throw new Error("bad eth_chainId");
  }
  const id = Number.parseInt(hex, 16);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("bad eth_chainId value");
  return id;
}

function chainIdStrict(env: NodeJS.ProcessEnv): boolean {
  const value = (env.LOK_CHAIN_ID_STRICT ?? "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

/**
 * Resolve and TTL-cache chain id from LOK_CHAIN_RPC; fall back to LOK_CHAIN_ID.
 * When LOK_CHAIN_ID_STRICT is set and RPC returns a different chain, throws.
 */
export async function refreshSettlementChainIdFromRpc(
  env: NodeJS.ProcessEnv = process.env,
): Promise<number> {
  const rpc = env.LOK_CHAIN_RPC?.trim();
  if (rpc) {
    try {
      const id = await ethChainId(rpc);
      const envId = envSettlementChainId(env);
      if (env.LOK_CHAIN_ID?.trim() && envId !== id) {
        const msg =
          "LOK_CHAIN_ID=" +
          envId +
          " differs from RPC eth_chainId=" +
          id;
        if (chainIdStrict(env)) {
          throw new Error(
            "[bellgrave] FATAL: " +
              msg +
              ". Set LOK_CHAIN_ID_STRICT=0 to allow mismatch or fix the RPC endpoint.",
          );
        }
        console.warn("[bellgrave] " + msg + "; using RPC for currency labels");
      }
      cachedRpcChainId = id;
      cacheExpiresAt = Date.now() + CHAIN_ID_CACHE_TTL_MS;
      return id;
    } catch (err) {
      if (err instanceof Error && err.message.includes("FATAL:")) throw err;
      console.warn(
        "[bellgrave] eth_chainId failed; currency labels fall back to LOK_CHAIN_ID:",
        err instanceof Error ? err.message : err,
      );
    }
  }
  cachedRpcChainId = null;
  cacheExpiresAt = 0;
  return envSettlementChainId(env);
}

/**
 * Periodically refresh the chain ID cache. Call this from a timer to keep the cache fresh.
 * Returns the current chain ID or null if refresh failed.
 */
export async function maybeRefreshChainIdCache(
  env: NodeJS.ProcessEnv = process.env,
): Promise<number | null> {
  if (Date.now() <= cacheExpiresAt) return cachedRpcChainId;
  try {
    return await refreshSettlementChainIdFromRpc(env);
  } catch {
    return null;
  }
}

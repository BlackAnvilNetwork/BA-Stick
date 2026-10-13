/**
 * Settlement chain id for currency labels / AhEscrow client config.
 * Prefer eth_chainId from LOK_CHAIN_RPC (cached at boot); fall back to LOK_CHAIN_ID.
 */
import { settlementCurrency } from "@bellgrave/config";

let cachedRpcChainId: number | null = null;

export function envSettlementChainId(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.LOK_CHAIN_ID?.trim() || "31337";
  if (!/^\d+$/.test(raw)) return 31337;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : 31337;
}

/** Last RPC-resolved chain id, or null if never refreshed. */
export function cachedSettlementChainId(): number | null {
  return cachedRpcChainId;
}

/** Test helper — clear / inject the RPC cache. */
export function setCachedSettlementChainId(id: number | null): void {
  cachedRpcChainId = id;
}

/**
 * Effective settlement chain: RPC cache when present, else LOK_CHAIN_ID / 31337.
 * Call `refreshSettlementChainIdFromRpc` at boot so labels match mint config.
 */
export function settlementChainId(env: NodeJS.ProcessEnv = process.env): number {
  return cachedRpcChainId ?? envSettlementChainId(env);
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

/** Resolve and cache chain id from LOK_CHAIN_RPC; fall back to LOK_CHAIN_ID. */
export async function refreshSettlementChainIdFromRpc(
  env: NodeJS.ProcessEnv = process.env,
): Promise<number> {
  const rpc = env.LOK_CHAIN_RPC?.trim();
  if (rpc) {
    try {
      const id = await ethChainId(rpc);
      const envId = envSettlementChainId(env);
      if (env.LOK_CHAIN_ID?.trim() && envId !== id) {
        console.warn(
          "[bellgrave] LOK_CHAIN_ID=" +
            envId +
            " differs from RPC eth_chainId=" +
            id +
            "; using RPC for currency labels",
        );
      }
      cachedRpcChainId = id;
      return id;
    } catch (err) {
      console.warn(
        "[bellgrave] eth_chainId failed; currency labels fall back to LOK_CHAIN_ID:",
        err instanceof Error ? err.message : err,
      );
    }
  }
  cachedRpcChainId = null;
  return envSettlementChainId(env);
}

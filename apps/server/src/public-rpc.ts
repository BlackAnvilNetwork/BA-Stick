/**
 * Client-facing RPC selection (#272).
 * Never put keyed operator RPCs (Alchemy/Infura path secrets) into WS snapshots.
 */
import { networkProfile } from "@bellgrave/config";

/** True when the URL looks like it embeds an API key in path/query/userinfo. */
export function rpcUrlLooksSecret(url: string | null | undefined): boolean {
  const raw = (url ?? "").trim();
  if (!raw) return false;
  try {
    const u = new URL(raw);
    if (u.username || u.password) return true;
    if (u.searchParams.has("api_key") || u.searchParams.has("apikey") || u.searchParams.has("key") || u.searchParams.has("token")) {
      return true;
    }
    // Alchemy / similar: /v2/<key>, Infura /v3/<key>, long path tokens
    if (/\/v\d+\/[A-Za-z0-9_-]{16,}/.test(u.pathname)) return true;
    if (/\/[A-Za-z0-9]{32,}/.test(u.pathname) && !/\/(gnosis|chiado|eth)/i.test(u.pathname)) return true;
    return false;
  } catch {
    return /\/v\d+\/[A-Za-z0-9_-]{16,}/.test(raw) || /[?&](api[_-]?key|apikey|key|token)=/i.test(raw);
  }
}

/** Loopback operator RPC (throwaway anvil, local node). Remote public hosts are not local. */
function rpcUrlIsLocal(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^\[|\]$/g, "").toLowerCase();
    return host === "127.0.0.1" || host === "localhost" || host === "0.0.0.0" || host === "::1";
  } catch {
    return false;
  }
}

function plainRpcUrl(raw: string | undefined): string {
  const cleaned = raw?.trim().replace(/\/$/, "") ?? "";
  if (!cleaned || rpcUrlLooksSecret(cleaned)) return "";
  if (/^https?:\/\//i.test(cleaned) || cleaned.startsWith("ws")) return cleaned;
  return "";
}

/**
 * RPC URL safe to hand to browsers and to use for this process's chain reads.
 * Prefer explicit LOK_PUBLIC_RPC when non-secret.
 * A non-secret loopback LOK_CHAIN_RPC wins over the profile default so a
 * throwaway anvil on a port other than 8545 is the chain we actually read.
 * Remote or secret operator RPCs still lose to the public profile URLs.
 */
export function resolvePublicRpcUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  const explicit = plainRpcUrl(env.LOK_PUBLIC_RPC);
  if (explicit) return explicit;
  const chain = plainRpcUrl(env.LOK_CHAIN_RPC);
  if (chain && rpcUrlIsLocal(chain)) return chain;
  const profile = networkProfile(env as Record<string, string | undefined>);
  for (const url of profile.rpcUrls) {
    const cleaned = plainRpcUrl(url);
    if (cleaned) return cleaned;
  }
  return chain || null;
}

/** Production: public RPC must be set (or profile-resolvable) and must not be the secret chain RPC. */
export function assertPublicRpcSafe(env: NodeJS.ProcessEnv = process.env): { ok: true; rpc: string } | { ok: false; error: string } {
  const publicRpc = resolvePublicRpcUrl(env);
  if (!publicRpc) {
    return {
      ok: false,
      error:
        "no client-safe LOK_PUBLIC_RPC (set a keyless public RPC; do not reuse keyed LOK_CHAIN_RPC in snapshots)",
    };
  }
  const chain = env.LOK_CHAIN_RPC?.trim().replace(/\/$/, "") ?? "";
  if (chain && rpcUrlLooksSecret(chain) && publicRpc === chain) {
    return {
      ok: false,
      error: "LOK_PUBLIC_RPC must not equal a secret-bearing LOK_CHAIN_RPC",
    };
  }
  if (env.LOK_PUBLIC_RPC?.trim() && rpcUrlLooksSecret(env.LOK_PUBLIC_RPC)) {
    return {
      ok: false,
      error: "LOK_PUBLIC_RPC looks like it embeds an API key — use a keyless public endpoint",
    };
  }
  return { ok: true, rpc: publicRpc };
}

/**
 * LocalStorage burner keys are OK for anvil-only local play.
 * On Gnosis / Chiado they must not be game-auth or pay identity (audit L-8 / C-1).
 */
import { resolveNetworkName, type NetworkName } from "@bellgrave/config";

export function viteNetworkName(
  env: Record<string, string | undefined> = {
    VITE_NETWORK: import.meta.env?.VITE_NETWORK,
    VITE_CHAIN_ID: import.meta.env?.VITE_CHAIN_ID,
  },
): NetworkName {
  return resolveNetworkName(env);
}

/** True when the Vite settlement profile is local anvil (31337). */
export function viteAnvilNetwork(
  env?: Record<string, string | undefined>,
): boolean {
  return viteNetworkName(env) === "anvil";
}

/**
 * Burner may be used as pay / game-auth identity only on anvil.
 * Gnosis (100) and Chiado (10200) require injected or Reown AppKit.
 */
export function burnerIdentityAllowed(
  env?: Record<string, string | undefined>,
): boolean {
  return viteAnvilNetwork(env);
}

/** Production Gnosis/Chiado builds must ship a Reown project id (no silent burner fallback). */
export function walletConnectRequiredForNetwork(
  env: Record<string, string | undefined>,
): boolean {
  return !viteAnvilNetwork(env);
}

export function assertWalletConnectProjectIdForPublicNetwork(
  env: Record<string, string | undefined>,
): void {
  if (!walletConnectRequiredForNetwork(env)) return;
  const id = env.VITE_WALLETCONNECT_PROJECT_ID?.trim();
  if (id && id.length >= 8) return;
  throw new Error(
    "VITE_WALLETCONNECT_PROJECT_ID is required when VITE_NETWORK is gnosis/chiado " +
      "(or VITE_CHAIN_ID is 100/10200). Get a project id from https://dashboard.reown.com",
  );
}

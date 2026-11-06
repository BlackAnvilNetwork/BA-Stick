/**
 * LocalStorage burner keys are OK for anvil-only local play.
 * On Gnosis / Chiado they must not be game-auth or pay identity (audit L-8 / C-1).
 */
import { resolveNetworkName, type NetworkName } from "@bellgrave/config";
import { privateKeyToAccount } from "viem/accounts";

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
  const e = env ?? {
    VITE_NETWORK: import.meta.env?.VITE_NETWORK,
    VITE_CHAIN_ID: import.meta.env?.VITE_CHAIN_ID,
  };
  const named = (e.VITE_NETWORK ?? "").trim().toLowerCase();
  const chain = (e.VITE_CHAIN_ID ?? "").trim();
  // Unset profile is not anvil. A Gnosis host with a missing Vite file must not
  // silently resume the leftover local burner.
  if (!named && !chain) return false;
  return named === "anvil" || chain === "31337";
}

/** localStorage key written by the anvil burner account helper. */
export const LOCAL_BURNER_WALLET_KEY = "bellgrave.wallet";
/** Companion private-key slot — address is derived in memory and never logged. */
export const LOCAL_BURNER_KEY_KEY = "bellgrave.walletKey";

function leftoverBurnerAddressFromStore(store: Pick<Storage, "getItem">): string | null {
  const stored = store.getItem(LOCAL_BURNER_WALLET_KEY)?.trim() ?? "";
  if (/^0x[0-9a-fA-F]{40}$/.test(stored)) return stored.toLowerCase();
  const key = store.getItem(LOCAL_BURNER_KEY_KEY)?.trim() ?? "";
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) return null;
  try {
    return privateKeyToAccount(key as `0x${string}`).address.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * True when `address` is this browser's leftover anvil burner on a public
 * network. Used to refuse silent resume / create-as-burner on Gnosis.
 * Matches `bellgrave.wallet` or the address derived from `bellgrave.walletKey`.
 * The key is never logged.
 */
export function isStoredLocalBurnerWallet(
  address: string,
  storage?: Pick<Storage, "getItem"> | null,
  env?: Record<string, string | undefined>,
): boolean {
  if (burnerIdentityAllowed(env)) return false;
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return false;
  try {
    const store = storage ?? (typeof localStorage !== "undefined" ? localStorage : null);
    if (!store) return false;
    const leftover = leftoverBurnerAddressFromStore(store);
    return !!leftover && leftover === address.toLowerCase();
  } catch {
    return false;
  }
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

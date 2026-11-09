/**
 * AppKit session helpers for login / mint / pay (viem over AppKit provider).
 * Modal init: appkit-config.ts
 */
import { settlementCurrency } from "@bellgrave/config";
import type { AppKit } from "@reown/appkit/react";
import { anvil, gnosis, gnosisChiado, type AppKitNetwork } from "@reown/appkit/networks";
import { createWalletClient, custom, type Account, type WalletClient } from "viem";
import { appKitConfigured, ensureAppKit } from "./appkit-config";
import { defaultRpcUrl } from "./walletconnect";
import {
  attachProviderChain,
  isWalletDisconnectedError,
  readProviderChainId,
  WALLET_DISCONNECTED_HINT,
} from "./wallet-provider";

export { appKitConfigured, ensureAppKit, appKitInitError } from "./appkit-config";

export type AppKitSession = {
  account: Account;
  address: `0x${string}`;
  client: WalletClient;
  source: "appkit";
  provider: unknown;
};

export type AppKitSessionOpts = {
  /** Switch the wallet to this chain before building the viem client (mint/pay). */
  chainId?: number;
  rpcUrl?: string;
};

function isAddress(a: unknown): a is `0x${string}` {
  return typeof a === "string" && /^0x[0-9a-fA-F]{40}$/.test(a);
}

function networkForChainId(chainId: number): AppKitNetwork | null {
  if (chainId === 100) return gnosis;
  if (chainId === 10200) return gnosisChiado;
  if (chainId === 31337) return anvil;
  return null;
}

/** Switch AppKit wallet to the settlement / pay chain when possible. */
export async function ensureAppKitChain(chainId: number, rpcUrl?: string): Promise<void> {
  const modal = ensureAppKit();
  if (!modal) return;
  const network = networkForChainId(chainId);
  if (!network) return;
  try {
    await modal.switchNetwork(network, { throwOnFailure: false });
  } catch (err) {
    console.warn(
      "[bellgrave] AppKit switchNetwork failed for chain " + chainId + ":",
      err instanceof Error ? err.message : err,
    );
  }
  void rpcUrl;
}

/** Build a viem session from an already-connected AppKit account (no modal open). */
export async function sessionFromConnectedAppKit(opts?: AppKitSessionOpts): Promise<AppKitSession> {
  const modal = ensureAppKit();
  if (!modal) {
    throw new Error("Reown AppKit is not configured (set VITE_WALLETCONNECT_PROJECT_ID).");
  }
  const address = modal.getAddress();
  if (!isAddress(address)) {
    throw new Error("No AppKit wallet connected yet.");
  }
  return sessionFromModal(modal, address, opts);
}

/**
 * Wait for AppKit to restore a previous pairing (no modal).
 * Returns null when nothing reconnects in time.
 */
export async function sessionFromRestoredAppKit(
  opts?: AppKitSessionOpts & { timeoutMs?: number; prefer?: string },
): Promise<AppKitSession | null> {
  const modal = ensureAppKit();
  if (!modal) return null;
  const prefer = opts?.prefer?.toLowerCase();
  const take = async (
    address: `0x${string}`,
    ignorePrefer = false,
  ): Promise<AppKitSession | null> => {
    if (!ignorePrefer && prefer && address.toLowerCase() !== prefer) return null;
    try {
      return await sessionFromModal(modal, address, opts);
    } catch {
      return null;
    }
  };
  const existing = modal.getAddress();
  // Live AppKit account wins over a stale persisted prefer (leftover burner).
  if (isAddress(existing)) return take(existing, true);

  const timeoutMs = opts?.timeoutMs ?? 2500;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (session: AppKitSession | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsub();
      resolve(session);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    const unsub = modal.subscribeAccount((state) => {
      if (!state.isConnected || !isAddress(state.address)) return;
      void take(state.address, true).then(finish);
    });
  });
}

/** Open AppKit Connect view and resolve when a wallet account is connected. */
export async function connectWithAppKit(opts?: AppKitSessionOpts): Promise<AppKitSession> {
  const modal = ensureAppKit();
  if (!modal) {
    throw new Error("Reown AppKit is not configured (set VITE_WALLETCONNECT_PROJECT_ID).");
  }

  const existingAddr = modal.getAddress();
  if (isAddress(existingAddr)) {
    return sessionFromModal(modal, existingAddr, opts);
  }

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      unsubAccount();
      unsubProviders();
      fn();
    };
    const timeout = setTimeout(() => {
      finish(() => reject(new Error("Wallet connect timed out.")));
    }, 180_000);

    const unsubAccount = modal.subscribeAccount((state) => {
      if (state.isConnected && isAddress(state.address)) {
        finish(() => resolve());
      }
    });
    const unsubProviders = modal.subscribeProviders(() => {
      if (isAddress(modal.getAddress())) {
        finish(() => resolve());
      }
    });

    void modal.open({ view: "Connect" }).catch((err: unknown) => {
      finish(() => reject(err instanceof Error ? err : new Error(String(err))));
    });
  });

  const address = modal.getAddress();
  if (!isAddress(address)) throw new Error("No wallet account after AppKit connect.");
  return sessionFromModal(modal, address, opts);
}

async function sessionFromModal(
  modal: AppKit,
  address: `0x${string}`,
  opts?: AppKitSessionOpts,
): Promise<AppKitSession> {
  const provider = modal.getWalletProvider() as {
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  } | null;
  if (!provider?.request) throw new Error("AppKit did not return a wallet provider.");

  const targetChainId = opts?.chainId;
  if (targetChainId != null) {
    await ensureAppKitChain(targetChainId, opts?.rpcUrl);
  }

  let chainId = targetChainId ?? (Number(import.meta.env.VITE_CHAIN_ID ?? "100") || 100);
  let reported = await readProviderChainId(provider);
  if (reported == null) {
    const attachTo = targetChainId ?? chainId;
    const attachRpc = opts?.rpcUrl ?? defaultRpcUrl(attachTo);
    try {
      await attachProviderChain(provider, attachTo, attachRpc);
      reported = await readProviderChainId(provider);
    } catch (err) {
      if (isWalletDisconnectedError(err) || (err instanceof Error && err.message === WALLET_DISCONNECTED_HINT)) {
        throw new Error(WALLET_DISCONNECTED_HINT);
      }
      throw err;
    }
  }
  if (reported != null && targetChainId == null) chainId = reported;
  if (targetChainId != null) chainId = targetChainId;

  const rpcUrl = opts?.rpcUrl ?? defaultRpcUrl(chainId);
  const cur = settlementCurrency(chainId);
  const client = createWalletClient({
    account: address,
    chain: {
      id: chainId,
      name: chainId === 31337 ? "Black Anvil Local" : cur.name,
      nativeCurrency: { name: cur.name, symbol: cur.symbol, decimals: cur.decimals },
      rpcUrls: { default: { http: [rpcUrl] } },
    },
    transport: custom(provider),
  });
  return {
    account: address as unknown as Account,
    address,
    client,
    source: "appkit",
    provider,
  };
}

export async function disconnectAppKit(): Promise<void> {
  const modal = ensureAppKit();
  if (!modal) return;
  try {
    await modal.disconnect();
  } catch {
    /* ignore */
  }
}

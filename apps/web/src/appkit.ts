/**
 * AppKit session helpers for login / mint / pay (viem over AppKit provider).
 * Modal init: appkit-config.ts
 */
import type { AppKit } from "@reown/appkit/react";
import { createWalletClient, custom, type Account, type WalletClient } from "viem";
import { appKitConfigured, ensureAppKit } from "./appkit-config";
import { defaultRpcUrl } from "./walletconnect";

export { appKitConfigured, ensureAppKit, appKitInitError } from "./appkit-config";

export type AppKitSession = {
  account: Account;
  address: `0x${string}`;
  client: WalletClient;
  source: "appkit";
  provider: unknown;
};

export function getAppKit(): AppKit | null {
  return ensureAppKit();
}

export function initAppKit(): void {
  ensureAppKit();
}

function isAddress(a: unknown): a is `0x${string}` {
  return typeof a === "string" && /^0x[0-9a-fA-F]{40}$/.test(a);
}

/** Build a viem session from an already-connected AppKit account (no modal open). */
export async function sessionFromConnectedAppKit(): Promise<AppKitSession> {
  const modal = ensureAppKit();
  if (!modal) {
    throw new Error("Reown AppKit is not configured (set VITE_WALLETCONNECT_PROJECT_ID).");
  }
  const address = modal.getAddress();
  if (!isAddress(address)) {
    throw new Error("No AppKit wallet connected yet.");
  }
  return sessionFromModal(modal, address);
}

/** Open AppKit Connect view and resolve when a wallet account is connected. */
export async function connectWithAppKit(): Promise<AppKitSession> {
  const modal = ensureAppKit();
  if (!modal) {
    throw new Error("Reown AppKit is not configured (set VITE_WALLETCONNECT_PROJECT_ID).");
  }

  const existingAddr = modal.getAddress();
  if (isAddress(existingAddr)) {
    return sessionFromModal(modal, existingAddr);
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
  return sessionFromModal(modal, address);
}

async function sessionFromModal(modal: AppKit, address: `0x${string}`): Promise<AppKitSession> {
  const provider = modal.getWalletProvider() as {
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  } | null;
  if (!provider?.request) throw new Error("AppKit did not return a wallet provider.");

  let chainId = Number(import.meta.env.VITE_CHAIN_ID ?? "100") || 100;
  try {
    const hex = (await provider.request({ method: "eth_chainId" })) as string;
    const n = Number.parseInt(hex, 16);
    if (Number.isSafeInteger(n) && n > 0) chainId = n;
  } catch {
    /* keep default */
  }
  const rpcUrl = defaultRpcUrl(chainId);
  const client = createWalletClient({
    account: address,
    chain: {
      id: chainId,
      name: String(chainId),
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
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

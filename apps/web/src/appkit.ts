/**
 * Reown AppKit wallet modal (injected / EIP-6963 / WalletConnect QR / Coinbase).
 * Uses VITE_WALLETCONNECT_PROJECT_ID as the Reown project id.
 *
 * Networks: Ethereum mainnet (home) + Gnosis 100 / Chiado 10200 from settlement;
 * anvil 31337 only in Vite DEV or VITE_ALLOW_ANVIL_WC.
 *
 * Login/mint use this instead of raw @walletconnect/ethereum-provider (QR-only).
 */
import { createAppKit, type AppKit } from "@reown/appkit/react";
import { EthersAdapter } from "@reown/appkit-adapter-ethers";
import {
  anvil,
  gnosis,
  gnosisChiado,
  mainnet,
  type AppKitNetwork,
} from "@reown/appkit/networks";
import { createWalletClient, custom, type Account, type WalletClient } from "viem";
import { anvilWalletConnectAllowed, defaultRpcUrl, walletConnectProjectId } from "./walletconnect";

export type AppKitSession = {
  account: Account;
  address: `0x${string}`;
  client: WalletClient;
  source: "appkit";
  provider: unknown;
};

let kit: AppKit | null = null;

function appKitNetworks(): [AppKitNetwork, ...AppKitNetwork[]] {
  const list: AppKitNetwork[] = [mainnet, gnosis, gnosisChiado];
  if (anvilWalletConnectAllowed()) list.push(anvil);
  return list as [AppKitNetwork, ...AppKitNetwork[]];
}

function defaultNetwork(): AppKitNetwork {
  const raw = import.meta.env.VITE_CHAIN_ID?.trim();
  const id = raw && /^\d+$/.test(raw) ? Number(raw) : 100;
  if (id === 1) return mainnet;
  if (id === 10200) return gnosisChiado;
  if (id === 31337 && anvilWalletConnectAllowed()) return anvil;
  return gnosis;
}

/** True when a Reown project id is present (AppKit can open). */
export function appKitConfigured(): boolean {
  return !!walletConnectProjectId();
}

/**
 * Create (or return) the AppKit singleton. Safe to call from main.tsx so modal UI
 * is ready before the user clicks Connect.
 */
export function getAppKit(): AppKit | null {
  if (kit) return kit;
  const projectId = walletConnectProjectId();
  if (!projectId) return null;

  const networks = appKitNetworks();
  const metadata = {
    name: "Legend of KEK",
    description: "Bellgrave — Legend of KEK",
    url: typeof window !== "undefined" ? window.location.origin : "https://legendofkek.com",
    icons: ["https://legendofkek.com/favicon.ico"],
  };

  const customRpcUrls = {
    [`eip155:${mainnet.id}`]: [{ url: defaultRpcUrl(1) }],
    [`eip155:${gnosis.id}`]: [{ url: defaultRpcUrl(100) }],
    [`eip155:${gnosisChiado.id}`]: [{ url: defaultRpcUrl(10200) }],
    ...(anvilWalletConnectAllowed()
      ? { [`eip155:${anvil.id}`]: [{ url: defaultRpcUrl(31337) }] }
      : {}),
  };

  kit = createAppKit({
    adapters: [new EthersAdapter()],
    networks,
    defaultNetwork: defaultNetwork(),
    projectId,
    metadata,
    customRpcUrls,
    // Full wallet list: EIP-6963 injected, WalletConnect, Coinbase (AppKit defaults).
    features: {
      analytics: false,
      email: false,
      socials: false,
      swaps: false,
      onramp: false,
    },
    allWallets: "SHOW",
    themeMode: "dark",
  });
  return kit;
}

/** Eager init for boot — no-op when project id missing. */
export function initAppKit(): void {
  try {
    getAppKit();
  } catch (err) {
    console.warn("[bellgrave] AppKit init failed", err);
    kit = null;
  }
}

function isAddress(a: unknown): a is `0x${string}` {
  return typeof a === "string" && /^0x[0-9a-fA-F]{40}$/.test(a);
}

/** Open AppKit Connect view and resolve when a wallet account is connected. */
export async function connectWithAppKit(): Promise<AppKitSession> {
  const modal = getAppKit();
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
  if (!kit) return;
  try {
    await kit.disconnect();
  } catch {
    /* ignore */
  }
}

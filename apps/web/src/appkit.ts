/**
 * Reown AppKit wallet modal (injected / EIP-6963 / WalletConnect QR / Coinbase).
 * Uses VITE_WALLETCONNECT_PROJECT_ID as the Reown project id.
 *
 * Networks: Ethereum mainnet (home) + Gnosis 100 / Chiado 10200 from settlement;
 * anvil 31337 only in Vite DEV or VITE_ALLOW_ANVIL_WC.
 */
import { createAppKit, type AppKit } from "@reown/appkit/react";
import { EthersAdapter } from "@reown/appkit-adapter-ethers";
import { anvil, gnosis, gnosisChiado, mainnet, type AppKitNetwork } from "@reown/appkit/networks";
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
let initAttempted = false;

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

export function getAppKit(): AppKit | null {
  if (kit) return kit;
  if (initAttempted) return null;
  initAttempted = true;
  const projectId = walletConnectProjectId();
  if (!projectId) return null;

  const networks = appKitNetworks();
  const metadata = {
    name: "Legend of KEK",
    description: "Bellgrave — Legend of KEK",
    url: typeof window !== "undefined" ? window.location.origin : "https://legendofkek.com",
    icons: [] as string[],
  };

  // customRpcUrls keyed by caip network id
  const customRpcUrls: Record<string, { url: string }[]> = {
    [`eip155:${gnosis.id}`]: [{ url: defaultRpcUrl(100) }],
    [`eip155:${gnosisChiado.id}`]: [{ url: defaultRpcUrl(10200) }],
    [`eip155:${mainnet.id}`]: [{ url: defaultRpcUrl(1) || "https://ethereum.publicnode.com" }],
  };
  if (anvilWalletConnectAllowed()) {
    customRpcUrls[`eip155:${anvil.id}`] = [{ url: defaultRpcUrl(31337) }];
  }

  kit = createAppKit({
    adapters: [new EthersAdapter()],
    networks,
    defaultNetwork: defaultNetwork(),
    projectId,
    metadata,
    customRpcUrls,
    features: {
      analytics: false,
      email: false,
      socials: false,
    },
    themeMode: "dark",
  });
  return kit;
}

function isAddress(a: unknown): a is `0x${string}` {
  return typeof a === "string" && /^0x[0-9a-fA-F]{40}$/.test(a);
}

/** Open AppKit modal and resolve when a wallet is connected. */
export async function connectWithAppKit(): Promise<AppKitSession> {
  const modal = getAppKit();
  if (!modal) {
    throw new Error("WalletConnect / Reown is not configured (set VITE_WALLETCONNECT_PROJECT_ID).");
  }

  const existingAddr = modal.getAddress();
  if (isAddress(existingAddr)) {
    return sessionFromModal(modal, existingAddr);
  }

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsub?.();
      reject(new Error("Wallet connect timed out."));
    }, 180_000);
    const unsub = modal.subscribeProviders(() => {
      const addr = modal.getAddress();
      if (isAddress(addr)) {
        clearTimeout(timeout);
        unsub?.();
        resolve();
      }
    });
    void modal.open({ view: "Connect" }).catch((err: unknown) => {
      clearTimeout(timeout);
      unsub?.();
      reject(err instanceof Error ? err : new Error(String(err)));
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

  let chainId = 1;
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

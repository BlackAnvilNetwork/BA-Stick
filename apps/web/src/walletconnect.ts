/**
 * WalletConnect v2 (QR / mobile) for auth + pay flows.
 * Requires VITE_WALLETCONNECT_PROJECT_ID. Never falls back to burner.
 */
import { EthereumProvider } from "@walletconnect/ethereum-provider";
import {
  createWalletClient,
  custom,
  type Account,
  type Chain,
  type WalletClient,
} from "viem";

export type WcSession = {
  account: Account;
  address: `0x${string}`;
  client: WalletClient;
  source: "walletconnect";
  provider: Awaited<ReturnType<typeof EthereumProvider.init>>;
};

let provider: Awaited<ReturnType<typeof EthereumProvider.init>> | null = null;

export function walletConnectProjectId(): string | null {
  const id = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID?.trim();
  return id && id.length >= 8 ? id : null;
}

export function walletConnectConfigured(): boolean {
  return !!walletConnectProjectId();
}

function chainOf(chainId: number, rpcUrl: string): Chain {
  return {
    id: chainId,
    name: chainId === 31337 ? "Bellgrave Anvil" : chainId === 4663 ? "Robinhood Chain" : "Bellgrave",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  };
}

export async function connectWalletConnect(opts: {
  chainId: number;
  rpcUrl: string;
}): Promise<WcSession> {
  const projectId = walletConnectProjectId();
  if (!projectId) {
    throw new Error("WalletConnect is not configured (set VITE_WALLETCONNECT_PROJECT_ID).");
  }
  if (!provider) {
    provider = await EthereumProvider.init({
      projectId,
      optionalChains: [opts.chainId],
      showQrModal: true,
      rpcMap: { [opts.chainId]: opts.rpcUrl },
      metadata: {
        name: "Legend of KEK",
        description: "Bellgrave — Legend of KEK",
        url: typeof window !== "undefined" ? window.location.origin : "https://legendofkek.com",
        icons: [],
      },
    });
  }
  await provider.enable();
  const accounts = provider.accounts as string[];
  const address = accounts[0] as `0x${string}` | undefined;
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new Error("WalletConnect did not return an account.");
  }
  const chain = chainOf(opts.chainId, opts.rpcUrl);
  const client = createWalletClient({
    account: address,
    chain,
    transport: custom(provider),
  });
  return {
    account: address as unknown as Account,
    address,
    client,
    source: "walletconnect",
    provider,
  };
}

export async function disconnectWalletConnect(): Promise<void> {
  if (!provider) return;
  try {
    await provider.disconnect();
  } catch {
    /* ignore */
  }
  provider = null;
}

export function activeWalletConnectProvider(): typeof provider {
  return provider;
}

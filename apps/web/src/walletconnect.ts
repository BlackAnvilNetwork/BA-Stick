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

/** Chains the game may use (Robinhood mainnet + local anvil preview). */
export const WALLETCONNECT_CHAIN_IDS = [4663, 31337] as const;

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

/** Default public RPC when env is blank or unset. */
export function defaultRpcUrl(chainId: number): string {
  if (chainId === 31337) {
    // Phone wallets cannot reach 127.0.0.1 — set VITE_ANVIL_PUBLIC_RPC_URL (e.g. LAN IP / tunnel).
    return (
      import.meta.env.VITE_ANVIL_PUBLIC_RPC_URL?.trim() ||
      import.meta.env.VITE_ANVIL_RPC_URL?.trim() ||
      "http://127.0.0.1:8545"
    );
  }
  if (chainId === 4663) {
    return (
      import.meta.env.VITE_RPC_URL?.trim() ||
      "https://rpc.mainnet.chain.robinhood.com"
    );
  }
  return import.meta.env.VITE_RPC_URL?.trim() || "http://127.0.0.1:8545";
}

function buildWalletConnectRpcMap(primaryChainId: number, primaryRpcUrl: string): Record<number, string> {
  const map: Record<number, string> = {};
  for (const id of WALLETCONNECT_CHAIN_IDS) {
    map[id] = id === primaryChainId ? primaryRpcUrl : defaultRpcUrl(id);
  }
  return map;
}

async function ensureProviderChain(
  wc: NonNullable<typeof provider>,
  chainId: number,
  rpcUrl: string,
): Promise<void> {
  const hexId = "0x" + chainId.toString(16);
  const chainName =
    chainId === 31337 ? "Bellgrave Anvil" : chainId === 4663 ? "Robinhood Chain" : "Bellgrave";
  try {
    await wc.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: hexId }],
    });
    return;
  } catch (err) {
    const code = (err as { code?: number })?.code;
    if (code !== 4902 && code !== -32603) throw err;
  }
  await wc.request({
    method: "wallet_addEthereumChain",
    params: [
      {
        chainId: hexId,
        chainName,
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        rpcUrls: [rpcUrl],
      },
    ],
  });
  await wc.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: hexId }],
  });
}

/** Switch an active WalletConnect session before pay/mint on another chain. */
export async function ensureWalletConnectChain(chainId: number, rpcUrl: string): Promise<void> {
  if (!provider) return;
  await ensureProviderChain(provider, chainId, rpcUrl);
}

export async function connectWalletConnect(opts: {
  chainId: number;
  rpcUrl: string;
}): Promise<WcSession> {
  const projectId = walletConnectProjectId();
  if (!projectId) {
    throw new Error("WalletConnect is not configured (set VITE_WALLETCONNECT_PROJECT_ID).");
  }
  const rpcMap = buildWalletConnectRpcMap(opts.chainId, opts.rpcUrl);
  if (!provider) {
    provider = await EthereumProvider.init({
      projectId,
      optionalChains: [4663, 31337],
      showQrModal: true,
      rpcMap,
      metadata: {
        name: "Legend of KEK",
        description: "Bellgrave — Legend of KEK",
        url: typeof window !== "undefined" ? window.location.origin : "https://legendofkek.com",
        icons: [],
      },
    });
  }
  await provider.enable();
  await ensureProviderChain(provider, opts.chainId, rpcMap[opts.chainId] ?? opts.rpcUrl);
  const accounts = provider.accounts as string[];
  const address = accounts[0] as `0x${string}` | undefined;
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new Error("WalletConnect did not return an account.");
  }
  const chain = chainOf(opts.chainId, rpcMap[opts.chainId] ?? opts.rpcUrl);
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

/**
 * WalletConnect v2 (QR / mobile) for auth + pay flows.
 * Requires VITE_WALLETCONNECT_PROJECT_ID. Never falls back to burner.
 *
 * Login (rule 5): connect + sign only — no forced chain switch.
 * Chain 31337 is optional only in Vite DEV or when VITE_ALLOW_ANVIL_WC=1.
 */
import { settlementCurrency } from "@bellgrave/config";
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

/** True when local anvil may appear in WalletConnect optionalChains. */
export function anvilWalletConnectAllowed(): boolean {
  return (
    import.meta.env.DEV === true ||
    import.meta.env.VITE_ALLOW_ANVIL_WC === "1" ||
    import.meta.env.VITE_ALLOW_ANVIL_WC === "true"
  );
}

/** Chains the game may use (Robinhood mainnet; anvil only when allowed). */
export function walletConnectChainIds(): readonly number[] {
  return anvilWalletConnectAllowed() ? ([4663, 31337] as const) : ([4663] as const);
}

/** @deprecated Use walletConnectChainIds() — 31337 is no longer always included. */
export const WALLETCONNECT_CHAIN_IDS = [4663, 31337] as const;

export function walletConnectProjectId(): string | null {
  const id = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID?.trim();
  return id && id.length >= 8 ? id : null;
}

export function walletConnectConfigured(): boolean {
  return !!walletConnectProjectId();
}

function chainOf(chainId: number, rpcUrl: string): Chain {
  const cur = settlementCurrency(chainId);
  const name =
    chainId === 31337
      ? "Bellgrave Anvil"
      : chainId === 4663
        ? "Robinhood Chain"
        : chainId === 100 || chainId === 10200
          ? cur.name
          : "Bellgrave";
  return {
    id: chainId,
    name,
    nativeCurrency: { name: cur.name, symbol: cur.symbol, decimals: cur.decimals },
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
  for (const id of walletConnectChainIds()) {
    map[id] = id === primaryChainId ? primaryRpcUrl : defaultRpcUrl(id);
  }
  // Always have an entry for the requested primary so pay flows still work.
  if (!map[primaryChainId]) map[primaryChainId] = primaryRpcUrl;
  return map;
}

async function ensureProviderChain(
  wc: NonNullable<typeof provider>,
  chainId: number,
  rpcUrl: string,
): Promise<void> {
  if (chainId === 31337 && !anvilWalletConnectAllowed()) {
    throw new Error("WalletConnect anvil (31337) is disabled outside local preview.");
  }
  const hexId = "0x" + chainId.toString(16);
  const cur = settlementCurrency(chainId);
  const chainName =
    chainId === 31337
      ? "Bellgrave Anvil"
      : chainId === 4663
        ? "Robinhood Chain"
        : chainId === 100 || chainId === 10200
          ? cur.name
          : "Bellgrave";
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
        nativeCurrency: { name: cur.name, symbol: cur.symbol, decimals: cur.decimals },
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

async function providerChainId(wc: NonNullable<typeof provider>): Promise<number> {
  try {
    const hex = (await wc.request({ method: "eth_chainId" })) as string;
    const n = Number.parseInt(hex, 16);
    if (Number.isSafeInteger(n) && n > 0) return n;
  } catch {
    /* fall through */
  }
  const fromProvider = Number((wc as { chainId?: number }).chainId);
  return Number.isSafeInteger(fromProvider) && fromProvider > 0 ? fromProvider : 4663;
}

export async function connectWalletConnect(opts: {
  chainId: number;
  rpcUrl: string;
  /**
   * When false, skip wallet_switchEthereumChain (login / sign-only).
   * Default true for pay/mint flows that must be on a specific home chain.
   */
  switchChain?: boolean;
}): Promise<WcSession> {
  const projectId = walletConnectProjectId();
  if (!projectId) {
    throw new Error("WalletConnect is not configured (set VITE_WALLETCONNECT_PROJECT_ID).");
  }
  if (opts.chainId === 31337 && !anvilWalletConnectAllowed()) {
    throw new Error("WalletConnect anvil (31337) is disabled outside local preview.");
  }
  const rpcMap = buildWalletConnectRpcMap(opts.chainId, opts.rpcUrl);
  const optionalChains = walletConnectChainIds();
  if (!provider) {
    provider = await EthereumProvider.init({
      projectId,
      optionalChains: optionalChains.length === 1 ? [optionalChains[0]!] : (optionalChains as [number, ...number[]]),
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
  const doSwitch = opts.switchChain !== false;
  if (doSwitch) {
    await ensureProviderChain(provider, opts.chainId, rpcMap[opts.chainId] ?? opts.rpcUrl);
  }
  const accounts = provider.accounts as string[];
  const address = accounts[0] as `0x${string}` | undefined;
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new Error("WalletConnect did not return an account.");
  }
  const sessionChainId = doSwitch ? opts.chainId : await providerChainId(provider);
  const sessionRpc =
    rpcMap[sessionChainId] ??
    defaultRpcUrl(sessionChainId) ??
    opts.rpcUrl;
  const chain = chainOf(sessionChainId, sessionRpc);
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

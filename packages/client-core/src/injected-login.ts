/**
 * MetaMask / EIP-1193 injected connect + sign — works without WalletConnect project id.
 */
import { settlementCurrency } from "@bellgrave/config";
import { createWalletClient, custom, type Account, type EIP1193Provider } from "viem";
import { defaultRpcUrl } from "./walletconnect";
import { attachProviderChain, readProviderChainId } from "./wallet-provider";

type Eip1193 = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function injectedProvider(): Eip1193 | null {
  if (typeof window === "undefined") return null;
  const eth = (window as unknown as { ethereum?: Eip1193 }).ethereum;
  return eth && typeof eth.request === "function" ? eth : null;
}

export function injectedWalletAvailable(): boolean {
  return !!injectedProvider();
}

/** Already-authorized injected accounts (no popup). */
export async function adoptInjectedWallet(opts?: {
  chainId?: number;
  rpcUrl?: string;
  prefer?: string;
}): Promise<{
  account: Account;
  address: `0x${string}`;
  client: ReturnType<typeof createWalletClient>;
  source: "injected";
} | null> {
  const ethereum = injectedProvider();
  if (!ethereum) return null;
  let accounts: string[] = [];
  try {
    accounts = (await ethereum.request({ method: "eth_accounts" })) as string[];
  } catch {
    return null;
  }
  const prefer = opts?.prefer?.toLowerCase();
  const raw = prefer
    ? accounts.find((a) => a.toLowerCase() === prefer) ?? accounts[0]
    : accounts[0];
  const address = raw as `0x${string}` | undefined;
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) return null;

  let chainId = opts?.chainId ?? Number(import.meta.env.VITE_CHAIN_ID ?? "100");
  const reported = await readProviderChainId(ethereum);
  if (reported != null) chainId = reported;
  const rpcUrl = opts?.rpcUrl ?? defaultRpcUrl(chainId);
  const cur = settlementCurrency(chainId);
  const client = createWalletClient({
    account: address,
    chain: {
      id: chainId,
      name: cur.name,
      nativeCurrency: { name: cur.name, symbol: cur.symbol, decimals: cur.decimals },
      rpcUrls: { default: { http: [rpcUrl] } },
    },
    transport: custom(ethereum as EIP1193Provider),
  });
  return {
    account: address as unknown as Account,
    address,
    client,
    source: "injected",
  };
}

export async function connectInjectedWallet(opts?: {
  chainId?: number;
  rpcUrl?: string;
  /** Login is sign-only — default false (no forced switch). */
  switchChain?: boolean;
}): Promise<{
  account: Account;
  address: `0x${string}`;
  client: ReturnType<typeof createWalletClient>;
  source: "injected";
}> {
  const ethereum = injectedProvider();
  if (!ethereum) throw new Error("No browser wallet detected (install MetaMask or Rabby).");

  const accounts = (await ethereum.request({ method: "eth_requestAccounts" })) as string[];
  const address = accounts[0] as `0x${string}` | undefined;
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new Error("No account selected in the browser wallet.");
  }

  let chainId = opts?.chainId ?? Number(import.meta.env.VITE_CHAIN_ID ?? "100");
  if (opts?.switchChain && opts.chainId && opts.rpcUrl) {
    const hexId = "0x" + opts.chainId.toString(16);
    try {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: hexId }],
      });
      chainId = opts.chainId;
    } catch (err) {
      const code = (err as { code?: number })?.code;
      if (code === 4902 || code === 4900 || code === -32603) {
        const cur = settlementCurrency(opts.chainId);
        await ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: hexId,
              chainName: cur.name,
              nativeCurrency: { name: cur.name, symbol: cur.symbol, decimals: cur.decimals },
              rpcUrls: [opts.rpcUrl],
            },
          ],
        });
        chainId = opts.chainId;
      }
    }
  } else {
    const reported = await readProviderChainId(ethereum);
    if (reported != null) chainId = reported;
    else {
      const rpc = opts?.rpcUrl ?? defaultRpcUrl(chainId);
      await attachProviderChain(ethereum, chainId, rpc);
    }
  }

  const rpcUrl = opts?.rpcUrl ?? defaultRpcUrl(chainId);
  const cur = settlementCurrency(chainId);
  const client = createWalletClient({
    account: address,
    chain: {
      id: chainId,
      name: cur.name,
      nativeCurrency: { name: cur.name, symbol: cur.symbol, decimals: cur.decimals },
      rpcUrls: { default: { http: [rpcUrl] } },
    },
    transport: custom(ethereum as EIP1193Provider),
  });
  return {
    account: address as unknown as Account,
    address,
    client,
    source: "injected",
  };
}

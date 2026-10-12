/**
 * Shared wallet helper: prefer EIP-1193 (injected) when available, else the
 * localStorage burner used for auth. Requests chain switch/add; does not
 * silently fall back to the burner when the user declines the extension.
 * WalletConnect sessions (when configured) are preferred over the burner for pay.
 */
import {
  createWalletClient,
  custom,
  http,
  type Account,
  type Chain,
  type WalletClient,
} from "viem";
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import {
  activeWalletConnectProvider,
  connectWalletConnect,
  ensureWalletConnectChain,
} from "./walletconnect";

const PK_KEY = "bellgrave.walletKey";
const WALLET_KEY = "bellgrave.wallet";
const PAYOUT_KEY = "bellgrave.payoutWallet";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}

export function burnerAccount(): PrivateKeyAccount {
  let key = localStorage.getItem(PK_KEY);
  const existingWallet = localStorage.getItem(WALLET_KEY);
  if (!key || !existingWallet || !/^0x[0-9a-fA-F]{40}$/.test(existingWallet)) {
    key = generatePrivateKey();
    localStorage.setItem(PK_KEY, key);
  }
  const account = privateKeyToAccount(key as `0x${string}`);
  localStorage.setItem(WALLET_KEY, account.address);
  return account;
}

export type WalletSession = {
  account: Account;
  address: `0x${string}`;
  client: WalletClient;
  source: "injected" | "burner" | "walletconnect";
};

function chainOf(chainId: number, rpcUrl: string): Chain {
  return {
    id: chainId,
    name: chainId === 31337 ? "Bellgrave Anvil" : "Bellgrave",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  };
}

async function ensureInjectedChain(
  ethereum: NonNullable<Window["ethereum"]>,
  chainId: number,
  rpcUrl: string,
): Promise<void> {
  const hexId = "0x" + chainId.toString(16);
  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: hexId }],
    });
    return;
  } catch (err) {
    const code = (err as { code?: number })?.code;
    // 4902 = unrecognized chain — add it
    if (code !== 4902 && code !== -32603) throw err;
  }
  await ethereum.request({
    method: "wallet_addEthereumChain",
    params: [
      {
        chainId: hexId,
        chainName: chainId === 31337 ? "Bellgrave Anvil" : "Bellgrave",
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        rpcUrls: [rpcUrl],
      },
    ],
  });
  await ethereum.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: hexId }],
  });
}

/** Remember the wallet that should receive AH sale proceeds. */
export function setPreferredPayoutWallet(address: string): void {
  if (/^0x[0-9a-fA-F]{40}$/.test(address)) {
    localStorage.setItem(PAYOUT_KEY, address.toLowerCase());
  }
}

export function preferredPayoutWallet(): `0x${string}` | null {
  const raw = localStorage.getItem(PAYOUT_KEY);
  if (raw && /^0x[0-9a-fA-F]{40}$/.test(raw)) return raw as `0x${string}`;
  const burner = localStorage.getItem(WALLET_KEY);
  if (burner && /^0x[0-9a-fA-F]{40}$/.test(burner)) return burner as `0x${string}`;
  return null;
}

/**
 * Prefer window.ethereum when available, then an active WalletConnect session,
 * then (optionally) open WalletConnect, else the burner when allowed.
 */
export async function getWalletSession(opts: {
  chainId: number;
  rpcUrl: string;
  preferInjected?: boolean;
  /** When false (default for pay flows), declining the extension does not fall back to burner. */
  allowBurnerFallback?: boolean;
  /** Open the WalletConnect modal when no injected wallet is present. */
  preferWalletConnect?: boolean;
}): Promise<WalletSession> {
  const chain = chainOf(opts.chainId, opts.rpcUrl);
  const prefer = opts.preferInjected !== false;
  const allowBurner = opts.allowBurnerFallback === true;
  if (prefer && typeof window !== "undefined" && window.ethereum) {
    try {
      await ensureInjectedChain(window.ethereum, opts.chainId, opts.rpcUrl);
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];
      const address = accounts[0] as `0x${string}` | undefined;
      if (address && /^0x[0-9a-fA-F]{40}$/.test(address)) {
        setPreferredPayoutWallet(address);
        const client = createWalletClient({
          account: address,
          chain,
          transport: custom(window.ethereum),
        });
        return { account: address as unknown as Account, address, client, source: "injected" };
      }
      if (!allowBurner) {
        throw new Error("No injected account selected. Connect your wallet or use WalletConnect.");
      }
    } catch (err) {
      if (!allowBurner) throw err;
      /* fall through */
    }
  }

  const existing = activeWalletConnectProvider();
  if (existing?.accounts?.[0]) {
    await ensureWalletConnectChain(opts.chainId, opts.rpcUrl);
    const address = existing.accounts[0] as `0x${string}`;
    setPreferredPayoutWallet(address);
    const client = createWalletClient({
      account: address,
      chain,
      transport: custom(existing),
    });
    return { account: address as unknown as Account, address, client, source: "walletconnect" };
  }

  if (opts.preferWalletConnect) {
    const wc = await connectWalletConnect({ chainId: opts.chainId, rpcUrl: opts.rpcUrl });
    setPreferredPayoutWallet(wc.address);
    return {
      account: wc.account,
      address: wc.address,
      client: wc.client,
      source: "walletconnect",
    };
  }

  if (!allowBurner) {
    throw new Error("Connect an injected wallet or WalletConnect to pay.");
  }
  const account = burnerAccount();
  setPreferredPayoutWallet(account.address);
  const client = createWalletClient({
    account,
    chain,
    transport: http(opts.rpcUrl),
  });
  return { account, address: account.address, client, source: "burner" };
}

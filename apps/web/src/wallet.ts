/**
 * Shared wallet helper: prefer EIP-1193 (injected) when available, else the
 * localStorage burner used for auth and AhEscrow buys.
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

const PK_KEY = "bellgrave.walletKey";
const WALLET_KEY = "bellgrave.wallet";

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
  source: "injected" | "burner";
};

function chainOf(chainId: number, rpcUrl: string): Chain {
  return {
    id: chainId,
    name: chainId === 31337 ? "Bellgrave Anvil" : "Bellgrave",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  };
}

/** Prefer window.ethereum when the user has connected; otherwise the burner. */
export async function getWalletSession(opts: {
  chainId: number;
  rpcUrl: string;
  preferInjected?: boolean;
}): Promise<WalletSession> {
  const chain = chainOf(opts.chainId, opts.rpcUrl);
  const prefer = opts.preferInjected !== false;
  if (prefer && typeof window !== "undefined" && window.ethereum) {
    try {
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];
      const address = accounts[0] as `0x${string}` | undefined;
      if (address && /^0x[0-9a-fA-F]{40}$/.test(address)) {
        const client = createWalletClient({
          account: address,
          chain,
          transport: custom(window.ethereum),
        });
        return { account: address as unknown as Account, address, client, source: "injected" };
      }
    } catch {
      /* fall through to burner */
    }
  }
  const account = burnerAccount();
  const client = createWalletClient({
    account,
    chain,
    transport: http(opts.rpcUrl),
  });
  return { account, address: account.address, client, source: "burner" };
}

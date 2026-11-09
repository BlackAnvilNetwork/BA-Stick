import { settlementCurrency } from "@bellgrave/config";

type Eip1193 = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

/** Rainbow / EIP-1193: no active chain (code 4900). */
export const WALLET_DISCONNECTED_HINT =
  "Wallet isn't on a network. Open it, pick Gnosis, then Connect again.";

export function isWalletDisconnectedError(err: unknown): boolean {
  let cur: unknown = err;
  for (let i = 0; i < 6 && cur; i++) {
    if (typeof cur === "string") {
      return /disconnected from all chains/i.test(cur);
    }
    if (typeof cur !== "object") return false;
    const row = cur as { code?: unknown; message?: unknown; cause?: unknown; error?: unknown };
    if (row.code === 4900 || row.code === "4900") return true;
    if (typeof row.message === "string" && /disconnected from all chains/i.test(row.message)) {
      return true;
    }
    cur = row.cause ?? row.error;
  }
  return false;
}

export async function readProviderChainId(provider: Eip1193): Promise<number | null> {
  try {
    const hex = (await provider.request({ method: "eth_chainId" })) as string;
    const n = Number.parseInt(hex, 16);
    return Number.isSafeInteger(n) && n > 0 ? n : null;
  } catch (err) {
    if (isWalletDisconnectedError(err)) return null;
    return null;
  }
}

/** When the wallet has no chain at all, attach Gnosis (or the given settlement chain). */
export async function attachProviderChain(
  provider: Eip1193,
  chainId: number,
  rpcUrl: string,
): Promise<void> {
  const hexId = "0x" + chainId.toString(16);
  const cur = settlementCurrency(chainId);
  const chainName = chainId === 31337 ? "Black Anvil Local" : cur.name;
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: hexId }],
    });
    return;
  } catch (err) {
    const code = (err as { code?: number })?.code;
    if (code !== 4902 && code !== 4900 && code !== -32603 && !isWalletDisconnectedError(err)) {
      throw err;
    }
  }
  try {
    await provider.request({
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
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: hexId }],
    });
  } catch (err) {
    if (isWalletDisconnectedError(err)) {
      throw new Error(WALLET_DISCONNECTED_HINT);
    }
    throw err;
  }
}

/** Rainbow injects uncaught 4900 promises into the page. Don't treat them as our crash. */
export function ignoreDisconnectedWalletRejections(): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as { __baIgnoreWallet4900?: boolean };
  if (w.__baIgnoreWallet4900) return;
  w.__baIgnoreWallet4900 = true;
  window.addEventListener("unhandledrejection", (ev) => {
    if (isWalletDisconnectedError(ev.reason)) ev.preventDefault();
  });
}

/**
 * Local EEZ sync buy via MockEezSyncBuy.syncBuy{value}.
 * Seller payout is already same-transaction inside AhEscrow.buyAsk.
 */
import { createPublicClient, http, type Hex } from "viem";
import type { EezSyncBuyClientConfig } from "@bellgrave/protocol";
import { getWalletSession } from "./wallet";
import { eezSyncBuyAvailable, selectedHomeChain } from "./eez-home-chain";

const SYNC_BUY_ABI = [
  {
    type: "function",
    name: "syncBuy",
    stateMutability: "payable",
    inputs: [
      { name: "listingId", type: "uint256" },
      { name: "buyerTokenId", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

export type EezBuyFill = {
  listingId: string;
  priceWei: string;
};

export async function buyAsksWithEezSync(opts: {
  eez: EezSyncBuyClientConfig;
  buyerTokenId: string;
  fills: EezBuyFill[];
  homeChainId?: number;
}): Promise<{ ok: true; hashes: Hex[] } | { ok: false; error: string; hashes: Hex[] }> {
  if (!opts.fills.length) return { ok: false, error: "No asks to buy.", hashes: [] };
  if (!eezSyncBuyAvailable(opts.eez) || !opts.eez.mockSyncBuy) {
    return { ok: false, error: "EEZ sync buy is not available.", hashes: [] };
  }
  if (!/^[1-9][0-9]{0,77}$/.test(opts.buyerTokenId)) {
    return { ok: false, error: "Bad buyer character id.", hashes: [] };
  }
  const home = selectedHomeChain(opts.eez, opts.homeChainId);
  if (!home) return { ok: false, error: "No home chain configured for sync buy.", hashes: [] };

  const hasInjected = typeof window !== "undefined" && !!window.ethereum;
  const session = await getWalletSession({
    chainId: home.chainId,
    rpcUrl: home.rpcUrl,
    allowBurnerFallback: !hasInjected,
  });
  const publicClient = createPublicClient({ transport: http(home.rpcUrl) });
  const hashes: Hex[] = [];
  const chain = {
    id: home.chainId,
    name: home.label,
    // Home-chain pay unit (ETH on Ethereum); settlement side is still native xDAI/ETH via EEZ.
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [home.rpcUrl] } },
  };

  for (const fill of opts.fills) {
    if (!/^[1-9][0-9]{0,77}$/.test(fill.listingId)) {
      return { ok: false, error: "Bad listing id.", hashes };
    }
    let value: bigint;
    try {
      value = BigInt(fill.priceWei);
    } catch {
      return { ok: false, error: "Bad ask price.", hashes };
    }
    if (value <= 0n) return { ok: false, error: "Ask price must be greater than 0.", hashes };
    try {
      const hash = await session.client.writeContract({
        address: opts.eez.mockSyncBuy as `0x${string}`,
        abi: SYNC_BUY_ABI,
        functionName: "syncBuy",
        args: [BigInt(fill.listingId), BigInt(opts.buyerTokenId)],
        value,
        account: session.account,
        chain,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "reverted") {
        return {
          ok: false,
          error: hashes.length
            ? "Paid " + hashes.length + " ask(s), then a sync buy reverted on-chain."
            : "Sync buy transaction reverted.",
          hashes,
        };
      }
      hashes.push(hash);
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        hashes,
      };
    }
  }
  return { ok: true, hashes };
}

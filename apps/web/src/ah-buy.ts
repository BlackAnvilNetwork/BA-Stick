/**
 * Client-signed AhEscrow.buyAsk — pays ETH from the browser wallet (injected
 * EIP-1193 when available, else the localStorage burner). The server watches
 * AskFilled and mirrors items via chainFill; this never credits ETH onto the log.
 *
 * EEZ sync buy (CrossChainProxy with msg.value) is not wired yet — see docs.
 */
import { createPublicClient, http, type Hex } from "viem";
import type { AhEscrowClientConfig } from "@bellgrave/protocol";
import { getWalletSession } from "./wallet";

const BUY_ASK_ABI = [
  {
    type: "function",
    name: "buyAsk",
    stateMutability: "payable",
    inputs: [
      { name: "listingId", type: "uint256" },
      { name: "buyerTokenId", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

export type BuyAskFill = {
  listingId: string;
  priceWei: string;
};

export async function buyAsksWithWallet(opts: {
  escrow: AhEscrowClientConfig;
  buyerTokenId: string;
  fills: BuyAskFill[];
}): Promise<{ ok: true; hashes: Hex[] } | { ok: false; error: string; hashes: Hex[] }> {
  if (!opts.fills.length) return { ok: false, error: "No asks to buy.", hashes: [] };
  if (!/^[1-9][0-9]{0,77}$/.test(opts.buyerTokenId)) {
    return { ok: false, error: "Bad buyer character id.", hashes: [] };
  }
  const hasInjected = typeof window !== "undefined" && !!window.ethereum;
  const session = await getWalletSession({
    chainId: opts.escrow.chainId,
    rpcUrl: opts.escrow.rpcUrl,
    // Pay with injected wallet when present; declining must not silently use burner funds.
    allowBurnerFallback: !hasInjected,
  });
  const publicClient = createPublicClient({ transport: http(opts.escrow.rpcUrl) });
  const hashes: Hex[] = [];
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
        address: opts.escrow.address as `0x${string}`,
        abi: BUY_ASK_ABI,
        functionName: "buyAsk",
        args: [BigInt(fill.listingId), BigInt(opts.buyerTokenId)],
        value,
        account: session.account,
        chain: {
          id: opts.escrow.chainId,
          name: "Bellgrave",
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: { default: { http: [opts.escrow.rpcUrl] } },
        },
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "reverted") {
        return {
          ok: false,
          error: hashes.length
            ? "Paid " + hashes.length + " ask(s), then a buy reverted on-chain."
            : "Buy transaction reverted.",
          hashes,
        };
      }
      hashes.push(hash);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        error: hashes.length
          ? "Paid " + hashes.length + " ask(s), then failed: " + msg
          : "Buy failed: " + msg,
        hashes,
      };
    }
  }
  return { ok: true, hashes };
}

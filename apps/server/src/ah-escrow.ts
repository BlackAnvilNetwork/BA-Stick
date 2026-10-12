/**
 * First-party AhEscrow helpers: open asks on-chain and mirror AskFilled into the
 * log as chainFill (items only — no settlement ETH on the character log).
 */
import type { LokWorld } from "./lok-world";

/** Keccak of AskFilled(uint256,address,uint256,address,uint256,uint256,uint256). */
export const ASK_FILLED_TOPIC = "0x4f31be848e37f66bf5ef389ecfd87011d9fbf0c3fcf65dbf46b119f5058564ca";

export type AskFilled = {
  listingId: string;
  buyer: string;
  buyerTokenId: string;
  sellerPayout: string;
  priceWei: string;
  itemId: string;
  amount: string;
};

export type ChainFillNote = {
  listingId: string;
  buyerTokenId: string;
  priceWei: string;
  /** Unique key for this on-chain fill (txHash-logIndex). */
  fillKey: string;
};

export function decodeAskFilled(log: { topics?: string[]; data?: string }): AskFilled | null {
  const topics = log.topics ?? [];
  if (topics.length < 4 || topics[0]?.toLowerCase() !== ASK_FILLED_TOPIC.toLowerCase()) return null;
  const data = log.data ?? "";
  // abi.encode(address sellerPayout, uint256 priceWei, uint256 itemId, uint256 amount)
  if (!data.startsWith("0x") || data.length < 2 + 64 * 4) return null;
  try {
    const sellerWord = data.slice(2, 2 + 64);
    const sellerPayout = "0x" + sellerWord.slice(24);
    return {
      listingId: BigInt(topics[1]!).toString(),
      buyer: "0x" + topics[2]!.slice(26),
      buyerTokenId: BigInt(topics[3]!).toString(),
      sellerPayout,
      priceWei: BigInt("0x" + data.slice(2 + 64, 2 + 128)).toString(),
      itemId: BigInt("0x" + data.slice(2 + 128, 2 + 192)).toString(),
      amount: BigInt("0x" + data.slice(2 + 192, 2 + 256)).toString(),
    };
  } catch {
    return null;
  }
}

/** Apply a fill the server already observed on-chain. Items move; ETH does not enter the log. */
export function applyAskFilled(
  lok: Pick<LokWorld, "noteChainFill" | "chainFill">,
  fill: AskFilled,
  fillKey: string,
): { ok: true } | { ok: false; error: string } {
  lok.noteChainFill({
    listingId: fill.listingId,
    buyerTokenId: fill.buyerTokenId,
    priceWei: fill.priceWei,
    fillKey,
  });
  return lok.chainFill(fill.listingId, fill.buyerTokenId, fill.priceWei, fillKey);
}

export function ahEscrowAddress(env: NodeJS.ProcessEnv = process.env): string | null {
  const addr = env.LOK_AH_ESCROW?.trim();
  return addr && /^0x[0-9a-fA-F]{40}$/.test(addr) ? addr : null;
}

export function openAskCastArgs(
  escrow: string,
  listingId: string,
  sellerTokenId: string,
  sellerPayout: string,
  itemId: string,
  amount: string,
  priceWei: string,
  rpc: string,
  key: string,
): string[] {
  return [
    "send",
    "--rpc-url",
    rpc,
    "--private-key",
    key,
    escrow,
    "openAsk(uint256,uint256,address,uint256,uint256,uint256)",
    listingId,
    sellerTokenId,
    sellerPayout,
    itemId,
    amount,
    priceWei,
  ];
}

export function cancelAskCastArgs(escrow: string, listingId: string, rpc: string, key: string): string[] {
  return ["send", "--rpc-url", rpc, "--private-key", key, escrow, "cancelAsk(uint256)", listingId];
}

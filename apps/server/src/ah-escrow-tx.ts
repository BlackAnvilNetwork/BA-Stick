/**
 * Serialized AhEscrow txs via viem (no private key on the cast argv).
 * One queue per listing key so concurrent list/cancel don't nonce-collide.
 */
import {
  createWalletClient,
  http,
  type Chain,
  type Hex,
  type TransactionReceipt,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ahEscrowAddress, ahEscrowClientConfig, listingRoleKey } from "./ah-escrow";

const AH_ABI = [
  {
    type: "function",
    name: "openAsk",
    stateMutability: "nonpayable",
    inputs: [
      { name: "listingId", type: "uint256" },
      { name: "sellerTokenId", type: "uint256" },
      { name: "sellerPayout", type: "address" },
      { name: "itemId", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "priceWei", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "cancelAsk",
    stateMutability: "nonpayable",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: [],
  },
] as const;

let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function chainOf(chainId: number, rpcUrl: string): Chain {
  return {
    id: chainId,
    name: chainId === 31337 ? "Bellgrave Anvil" : "Bellgrave",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  };
}

function client(env: NodeJS.ProcessEnv = process.env) {
  const cfg = ahEscrowClientConfig(env);
  const key = listingRoleKey(env);
  const escrow = ahEscrowAddress(env);
  if (!cfg || !key || !escrow) {
    return { ok: false as const, error: "AhEscrow listing signer is not configured." };
  }
  const account = privateKeyToAccount(key as Hex);
  const chain = chainOf(cfg.chainId, cfg.rpcUrl);
  const wallet = createWalletClient({
    account,
    chain,
    transport: http(cfg.rpcUrl),
  });
  return { ok: true as const, wallet, account, chain, escrow: escrow as `0x${string}`, cfg };
}

async function waitReceipt(
  wallet: ReturnType<typeof createWalletClient>,
  hash: Hex,
): Promise<TransactionReceipt> {
  // viem public actions aren't on wallet client by default in all setups — poll eth_getTransactionReceipt.
  const rpc = wallet.transport;
  void rpc;
  const { createPublicClient, http: httpTransport } = await import("viem");
  const cfg = ahEscrowClientConfig();
  if (!cfg) throw new Error("missing rpc");
  const pub = createPublicClient({
    chain: chainOf(cfg.chainId, cfg.rpcUrl),
    transport: httpTransport(cfg.rpcUrl),
  });
  return pub.waitForTransactionReceipt({ hash, confirmations: 1 });
}

export async function openAskOnchain(opts: {
  listingId: string;
  sellerTokenId: string;
  sellerPayout: string;
  itemId: string;
  amount: string;
  priceWei: string;
  env?: NodeJS.ProcessEnv;
}): Promise<{ ok: true; hash: Hex } | { ok: false; error: string }> {
  return enqueue(async () => {
    const c = client(opts.env);
    if (!c.ok) return c;
    if (!/^0x[0-9a-fA-F]{40}$/.test(opts.sellerPayout)) {
      return { ok: false, error: "Seller payout wallet is missing. Nothing was listed on-chain." };
    }
    try {
      const hash = await c.wallet.writeContract({
        address: c.escrow,
        abi: AH_ABI,
        functionName: "openAsk",
        args: [
          BigInt(opts.listingId),
          BigInt(opts.sellerTokenId),
          opts.sellerPayout as `0x${string}`,
          BigInt(opts.itemId),
          BigInt(opts.amount),
          BigInt(opts.priceWei),
        ],
        account: c.account,
        chain: c.chain,
      });
      const receipt = await waitReceipt(c.wallet, hash);
      if (receipt.status !== "success") {
        return { ok: false, error: "openAsk reverted on-chain." };
      }
      return { ok: true, hash };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}

export async function cancelAskOnchain(opts: {
  listingId: string;
  env?: NodeJS.ProcessEnv;
}): Promise<{ ok: true; hash: Hex; alreadyClosed?: boolean } | { ok: false; error: string }> {
  return enqueue(async () => {
    const c = client(opts.env);
    if (!c.ok) return c;
    try {
      const hash = await c.wallet.writeContract({
        address: c.escrow,
        abi: AH_ABI,
        functionName: "cancelAsk",
        args: [BigInt(opts.listingId)],
        account: c.account,
        chain: c.chain,
      });
      const receipt = await waitReceipt(c.wallet, hash);
      if (receipt.status !== "success") {
        return { ok: false, error: "cancelAsk reverted on-chain." };
      }
      return { ok: true, hash };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/AskClosed|ask closed/i.test(msg)) {
        return { ok: true, hash: "0x" as Hex, alreadyClosed: true };
      }
      return { ok: false, error: msg };
    }
  });
}

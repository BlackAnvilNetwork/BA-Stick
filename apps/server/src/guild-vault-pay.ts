/**
 * Send a scheduled guild payout on local anvil.
 *
 * The amounts are the Mark Safe and Guild Wallet shares from `splitGuildEarning`.
 * `GuildVault.pay` sends that stored list. This does not choose a new recipient.
 * Gnosis and Chiado are refused. The tick does not call this.
 *
 * The send counts toward the epoch cap: 10% of the slashable bonds posted now.
 * Zero bonds refuse the send. This does not invent a bond.
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import type { GuildShare } from "./guild-score";
import { chainBoundXdaiSend, releaseEpochXdai } from "./root-anchor";

const ANVIL_CHAIN_ID = 31337n;

const VAULT_ABI = parseAbi([
  "function payer() view returns (address)",
  "function schedule(address[] to, uint256[] amounts)",
  "function pay()",
]);

export type GuildVaultPayResult =
  | { ok: true; sentWei: bigint }
  | { ok: false; error: string };

function localAnvilRpc(rpc: string): boolean {
  return /^https?:\/\/(127\.0\.0\.1|localhost):\d+\/?$/i.test(rpc.trim());
}

async function assertLocalAnvil(rpc: string): Promise<string | null> {
  const url = rpc.trim();
  if (!localAnvilRpc(url)) return "Guild vault payout refuses a non-local RPC";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
    });
    const body = (await res.json()) as { result?: string };
    if (!body.result) return "anvil chain id was not available";
    if (BigInt(body.result) !== ANVIL_CHAIN_ID) return "Guild vault payout refuses chain " + BigInt(body.result).toString();
  } catch {
    return "anvil chain id was not available";
  }
  return null;
}

/** Admit one guild-vault send under the existing epoch cap. Does not broadcast. */
export function admitGuildPayout(amountWei: bigint): { ok: true; epoch: number } | { ok: false; error: string } {
  const admitted = chainBoundXdaiSend("guild", amountWei);
  if (!admitted.ok) return admitted;
  return { ok: true, epoch: admitted.epoch };
}

/**
 * Schedule and pay the given shares on a local anvil GuildVault.
 * The payer key must be the vault's payer. A failed send releases the cap admission.
 */
export async function payGuildVault(args: {
  rpc: string;
  vault: `0x${string}`;
  payerKey: Hex;
  shares: readonly GuildShare[];
}): Promise<GuildVaultPayResult> {
  const refused = await assertLocalAnvil(args.rpc);
  if (refused) return { ok: false, error: refused };
  if (args.shares.length === 0) return { ok: false, error: "Guild vault payout has no shares" };
  let sentWei = 0n;
  const to: `0x${string}`[] = [];
  const amounts: bigint[] = [];
  for (const share of args.shares) {
    if (share.wei <= 0n) return { ok: false, error: "Guild vault payout amount is empty" };
    to.push(share.to);
    amounts.push(share.wei);
    sentWei += share.wei;
  }
  const account = privateKeyToAccount(args.payerKey);
  const client = createPublicClient({ chain: foundry, transport: http(args.rpc) });
  const payer = await client.readContract({ address: args.vault, abi: VAULT_ABI, functionName: "payer" });
  if (payer.toLowerCase() !== account.address.toLowerCase()) {
    return { ok: false, error: "Guild vault payer does not match" };
  }
  const balance = await client.getBalance({ address: args.vault });
  if (sentWei > balance) return { ok: false, error: "Guild vault payout exceeds the balance" };
  const admitted = admitGuildPayout(sentWei);
  if (!admitted.ok) return admitted;
  const wallet = createWalletClient({ account, chain: foundry, transport: http(args.rpc) });
  try {
    const scheduled = await wallet.writeContract({
      address: args.vault,
      abi: VAULT_ABI,
      functionName: "schedule",
      args: [to, amounts],
    });
    const scheduleReceipt = await client.waitForTransactionReceipt({ hash: scheduled });
    if (scheduleReceipt.status !== "success") {
      releaseEpochXdai(sentWei, admitted.epoch);
      return { ok: false, error: "Guild vault schedule failed" };
    }
    const paid = await wallet.writeContract({
      address: args.vault,
      abi: VAULT_ABI,
      functionName: "pay",
    });
    const payReceipt = await client.waitForTransactionReceipt({ hash: paid });
    if (payReceipt.status !== "success") {
      releaseEpochXdai(sentWei, admitted.epoch);
      return { ok: false, error: "Guild vault pay failed" };
    }
    return { ok: true, sentWei };
  } catch (err) {
    releaseEpochXdai(sentWei, admitted.epoch);
    return { ok: false, error: err instanceof Error ? err.message : "Guild vault payout failed" };
  }
}

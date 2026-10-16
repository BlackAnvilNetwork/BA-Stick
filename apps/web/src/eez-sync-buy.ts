/**
 * Local EEZ sync buy via MockEezSyncBuy.syncBuy{value}.
 * That call pays AhEscrow.buyAskFor. The price is admitted before syncBuy is broadcast.
 * Seller payout is already same-transaction inside AhEscrow.buyAskFor.
 * Wallet routing matches ah-buy / character-mint (never burner on Gnosis/Chiado).
 */
import { settlementCurrency } from "@bellgrave/config";
import { createPublicClient, http, type Hex } from "viem";
import type { EezSyncBuyClientConfig } from "@bellgrave/protocol";
import { appKitConfigured } from "./appkit";
import { burnerIdentityAllowed } from "./burner-identity";
import { eezSyncBuyAvailable, selectedHomeChain } from "./eez-home-chain";
import { hasInjectedWallet, payWalletSessionOpts } from "./pay-wallet";
import { getWalletSession, type WalletSession } from "./wallet";

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

export type EscrowFillAdmission =
  | { ok: true; epoch: number }
  | { ok: false; error: string };

export type PayWalletFlags = {
  hasInjected: boolean;
  appKitConfigured: boolean;
  burnerAllowed?: boolean;
};

export async function buyAsksWithEezSync(opts: {
  eez: EezSyncBuyClientConfig;
  buyerTokenId: string;
  fills: EezBuyFill[];
  homeChainId?: number;
  /** Reserves the ask price before syncBuy broadcasts. Production asks the server. */
  admitFill?: (priceWei: string) => Promise<EscrowFillAdmission>;
  getSession?: typeof getWalletSession;
  forceWalletFlags?: PayWalletFlags;
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

  const flags: PayWalletFlags =
    opts.forceWalletFlags ??
    {
      hasInjected: hasInjectedWallet(),
      appKitConfigured: appKitConfigured(),
      burnerAllowed: burnerIdentityAllowed(),
    };
  const burnerAllowed = flags.burnerAllowed ?? burnerIdentityAllowed();
  const sessionOpts = payWalletSessionOpts({
    hasInjected: flags.hasInjected,
    appKitConfigured: flags.appKitConfigured,
    burnerAllowed,
  });
  let session: WalletSession;
  try {
    session = await (opts.getSession ?? getWalletSession)({
      chainId: home.chainId,
      rpcUrl: home.rpcUrl,
      allowBurnerFallback: sessionOpts.allowBurnerFallback,
      preferWalletConnect: sessionOpts.preferWalletConnect,
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      hashes: [],
    };
  }
  if (session.source === "burner" && !burnerAllowed) {
    return {
      ok: false,
      error: "Refusing to pay with local burner on this network. Connect a wallet.",
      hashes: [],
    };
  }
  const publicClient = createPublicClient({ transport: http(home.rpcUrl) });
  const hashes: Hex[] = [];
  const cur = settlementCurrency(home.chainId);
  const chain = {
    id: home.chainId,
    name: home.label,
    nativeCurrency: { name: cur.name, symbol: cur.symbol, decimals: cur.decimals },
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
    const serverHold = opts.admitFill == null;
    const admitted = opts.admitFill
      ? await opts.admitFill(fill.priceWei)
      : await import("./net").then((net) => net.requestEscrowFillAdmission(fill.priceWei));
    if (!admitted.ok) return { ok: false, error: admitted.error, hashes };
    let sent = false;
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
      sent = true;
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "reverted") {
        if (serverHold) {
          const { releaseEscrowFillOnServer } = await import("./net");
          await releaseEscrowFillOnServer(fill.priceWei, admitted.epoch);
        }
        return {
          ok: false,
          error: hashes.length
            ? "Paid " + hashes.length + " ask(s), then a sync buy reverted on-chain."
            : "Sync buy transaction reverted.",
          hashes,
        };
      }
      if (serverHold) {
        let paidAtMs = Date.now();
        try {
          const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber });
          paidAtMs = Number(block.timestamp) * 1000;
        } catch {
          paidAtMs = Date.now();
        }
        const { pinEscrowFillOnServer } = await import("./net");
        await pinEscrowFillOnServer(fill.priceWei, admitted.epoch, paidAtMs);
      }
      hashes.push(hash);
    } catch (err) {
      if (serverHold && !sent) {
        const { releaseEscrowFillOnServer } = await import("./net");
        await releaseEscrowFillOnServer(fill.priceWei, admitted.epoch);
      }
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        hashes,
      };
    }
  }
  return { ok: true, hashes };
}

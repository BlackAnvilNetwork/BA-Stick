/**
 * Periodic LISTING / ROTATOR / PROPOSER balance probe (H-1).
 * Avoids creating a new viem client on every lok/list.
 */
import { createPublicClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ahEscrowClientConfig, listingRoleKey } from "./ah-escrow";
import { maybeAlertListingLowBalance } from "./lok-list-rate";
import { opsAlert } from "./ops-log";
import { envSettlementChainId } from "./settlement-chain";

let sharedPub: ReturnType<typeof createPublicClient> | null = null;
let sharedRpc = "";

function publicClient(env: NodeJS.ProcessEnv = process.env) {
  const cfg = ahEscrowClientConfig(env);
  if (!cfg) return null;
  if (!sharedPub || sharedRpc !== cfg.rpcUrl) {
    sharedPub = createPublicClient({
      chain: {
        id: envSettlementChainId(env),
        name: "settlement",
        nativeCurrency: { name: "xDAI", symbol: "xDAI", decimals: 18 },
        rpcUrls: { default: { http: [cfg.rpcUrl] } },
      },
      transport: http(cfg.rpcUrl),
    });
    sharedRpc = cfg.rpcUrl;
  }
  return sharedPub;
}

function keyAddress(raw: string | undefined): string | null {
  const key = raw?.trim();
  if (!key) return null;
  try {
    return privateKeyToAccount((key.startsWith("0x") ? key : "0x" + key) as Hex).address.toLowerCase();
  } catch {
    return null;
  }
}

export type ServerKeyBalances = {
  listing: { address: string; balanceWei: string } | null;
  rotator: { address: string; balanceWei: string } | null;
  proposer: { address: string; balanceWei: string } | null;
};

let lastSnapshot: ServerKeyBalances = { listing: null, rotator: null, proposer: null };

export function lastServerKeyBalances(): ServerKeyBalances {
  return lastSnapshot;
}

export async function probeServerKeyBalances(
  env: NodeJS.ProcessEnv = process.env,
): Promise<ServerKeyBalances> {
  const pub = publicClient(env);
  const out: ServerKeyBalances = { listing: null, rotator: null, proposer: null };
  if (!pub) return out;

  const rows: [keyof ServerKeyBalances, string | null][] = [
    ["listing", keyAddress(listingRoleKey(env) ?? env.LOK_LISTING_KEY)],
    ["rotator", keyAddress(env.LOK_ROTATOR_KEY)],
    ["proposer", keyAddress(env.LOK_PROPOSER_KEY)],
  ];
  for (const [slot, address] of rows) {
    if (!address) continue;
    try {
      const bal = await pub.getBalance({ address: address as Hex });
      out[slot] = { address, balanceWei: bal.toString() };
      if (slot === "listing") {
        void maybeAlertListingLowBalance({ balanceWei: bal, address, env });
      } else {
        const low = env.LOK_LISTING_LOW_BALANCE_WEI?.trim();
        const wei = low && /^\d+$/.test(low) ? BigInt(low) : 5n * 10n ** 16n;
        if (bal < wei) {
          opsAlert({
            level: "alert",
            event: "ops",
            msg: slot.toUpperCase() + " wallet low balance",
            address,
            balanceWei: bal.toString(),
            thresholdWei: wei.toString(),
            dedupeKey: slot + "-low-bal",
          });
        }
      }
    } catch {
      /* ignore probe errors */
    }
  }
  lastSnapshot = out;
  return out;
}

export function startListingBalanceProbe(opts?: {
  env?: NodeJS.ProcessEnv;
  intervalMs?: number;
}): void {
  const env = opts?.env ?? process.env;
  const tick = () => {
    void probeServerKeyBalances(env).catch(() => undefined);
  };
  tick();
  const timer = setInterval(tick, opts?.intervalMs ?? 60_000);
  timer.unref?.();
}

export function resetListingBalanceProbeForTests(): void {
  sharedPub = null;
  sharedRpc = "";
  lastSnapshot = { listing: null, rotator: null, proposer: null };
}

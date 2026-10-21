/**
 * A bonded operator's own process brings that Mark online.
 * The operator key pays for the Mark Safe. A replica does not. The listing
 * key does not. This does not open a guild and does not invent a bond.
 * Deploy still refuses every chain except local anvil until the Gnosis salt
 * change is the path `markComesOnline` uses.
 */
import { isAddress, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { replicaFlagEnabled } from "./installed-game-mode";
import { markComesOnline, type LocalSafeContracts, type OpenedSafeResult } from "./guild-safes";
import { PINNED_GNOSIS_LISTING_ADDRESS } from "./production-boot";
import { postedSlashableBond } from "./root-anchor";

export type MarkOnlineResult =
  | { ok: true; skipped: true }
  | { ok: true; skipped: false; deployed: boolean; address: `0x${string}` }
  | { ok: false; error: string };

function accountOf(key: string): `0x${string}` | null {
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) return null;
  try {
    return privateKeyToAccount(key as Hex).address;
  } catch {
    return null;
  }
}

function contractOf(value: string | undefined): `0x${string}` | null {
  const trimmed = value?.trim() ?? "";
  if (!isAddress(trimmed)) return null;
  return trimmed;
}

function safeContracts(env: NodeJS.ProcessEnv): LocalSafeContracts | null {
  const safeSingletonAddress = contractOf(env.LOK_SAFE_SINGLETON);
  const safeProxyFactoryAddress = contractOf(env.LOK_SAFE_PROXY_FACTORY);
  const fallbackHandlerAddress = contractOf(env.LOK_SAFE_FALLBACK_HANDLER);
  const multiSendAddress = contractOf(env.LOK_SAFE_MULTISEND);
  const multiSendCallOnlyAddress = contractOf(env.LOK_SAFE_MULTISEND_CALL_ONLY);
  if (
    !safeSingletonAddress ||
    !safeProxyFactoryAddress ||
    !fallbackHandlerAddress ||
    !multiSendAddress ||
    !multiSendCallOnlyAddress
  ) {
    return null;
  }
  return {
    safeSingletonAddress,
    safeProxyFactoryAddress,
    fallbackHandlerAddress,
    multiSendAddress,
    multiSendCallOnlyAddress,
  };
}

/**
 * Deploy the Mark Safe for the bonded operator in this environment.
 * A replica returns before the key is read. A missing key, a missing bond,
 * or missing Safe addresses skips. The listing key is refused.
 */
export async function bringBondedMarkOnline(env: NodeJS.ProcessEnv = process.env): Promise<MarkOnlineResult> {
  if (replicaFlagEnabled(env)) return { ok: true, skipped: true };
  const key = env.LOK_MARK_OPERATOR_KEY?.trim() ?? "";
  const operatorId = env.LOK_MARK_OPERATOR_ID?.trim() ?? "";
  const rpc = env.LOK_CHAIN_RPC?.trim() ?? "";
  if (!key || !operatorId || !rpc) return { ok: true, skipped: true };
  const owner = accountOf(key);
  if (!owner) return { ok: false, error: "Mark operator key is not a key" };
  const listingKey = env.LOK_LISTING_KEY?.trim().toLowerCase() ?? "";
  if (
    owner.toLowerCase() === PINNED_GNOSIS_LISTING_ADDRESS.toLowerCase() ||
    (listingKey !== "" && listingKey === key.toLowerCase())
  ) {
    return { ok: false, error: "The listing key is not a Mark" };
  }
  if (postedSlashableBond(operatorId) <= 0n) return { ok: true, skipped: true };
  const contracts = safeContracts(env);
  if (!contracts) return { ok: true, skipped: true };
  const opened: OpenedSafeResult = await markComesOnline({
    rpc,
    operatorId,
    operatorKey: key,
    contracts,
  });
  if (!opened.ok) return opened;
  return { ok: true, skipped: false, deployed: opened.deployed, address: opened.address };
}

/**
 * Hard denylist of the 2026-10-12 Gnosis dry-run deployment (MockItems Checkpoint).
 * Refuse boot / address fill when any LOK_* matches these on chain 100.
 */
export const GNOSIS_DRY_RUN_ADDRESSES = {
  CharacterNFT: "0xf4bab9b8cb8bc3d9340ee73447009da77dc95663",
  CharacterCheckpoint: "0xa185dd8d09bd83ceebadbe4fa1ca8e90babcdd0b",
  CharacterFactory: "0xce70705322a10c3c85363ad067743923f5e5e8f2",
  RulesetRegistry: "0x785e42614bbd49910b4b15a0eb55e21e94b74bef",
  AhEscrow: "0xb48031d00e27ff94bd3c677d2f4d6948f365478c",
  MockItems: "0x63a3c15d4098c28fbd8771f17bb6f8ab34472235",
  MockKEK: "0x4156acfc09838d8f55a4044720cb67b2e0fc98e7",
} as const;

const DENY = new Set(Object.values(GNOSIS_DRY_RUN_ADDRESSES));

export function isDryRunAddress(addr: string | undefined | null): boolean {
  if (!addr || !/^0x[0-9a-fA-F]{40}$/.test(addr.trim())) return false;
  return DENY.has(addr.trim().toLowerCase() as (typeof GNOSIS_DRY_RUN_ADDRESSES)[keyof typeof GNOSIS_DRY_RUN_ADDRESSES]);
}

/** Env keys that must never hold dry-run contract addresses on production. */
export const DRY_RUN_ENV_KEYS = [
  "LOK_NFT",
  "LOK_FACTORY",
  "LOK_AH_ESCROW",
  "LOK_CHECKPOINT",
  "LOK_RULESETS",
  "LOK_ITEMS",
] as const;

export type DryRunDenyHit = { key: string; address: string };

export function findDryRunEnvHits(env: NodeJS.ProcessEnv = process.env): DryRunDenyHit[] {
  const hits: DryRunDenyHit[] = [];
  for (const key of DRY_RUN_ENV_KEYS) {
    const v = env[key]?.trim();
    if (v && isDryRunAddress(v)) hits.push({ key, address: v.toLowerCase() });
  }
  return hits;
}

import { envSettlementChainId } from "./settlement-chain";

/**
 * True when dry-run addresses are allowed (explicit opt-in AND not production
 * without the inspection flag). Production chains (Gnosis 100 / Chiado 10200)
 * never allow denylist hits regardless of NETWORK name.
 */
export function dryRunDeployAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.LOK_ALLOW_DRY_RUN_DEPLOY?.trim() !== "1") return false;
  const chainId = envSettlementChainId(env);
  if (chainId === 100 || chainId === 10200) return false;
  const named = (env.NETWORK ?? env.LOK_NETWORK)?.trim().toLowerCase();
  if (named === "gnosis" || named === "chiado") return false;
  return env.LOK_DRY_RUN_INSPECT?.trim() === "1" || named === "anvil";
}

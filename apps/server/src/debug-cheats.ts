import { isProductionSettlementChain } from "./production-boot";

/** Dev cheats are off unless ALLOW_DEBUG_CHEATS=1 and not on a production chain (Gnosis/Chiado). */
export function debugCheatsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.ALLOW_DEBUG_CHEATS !== "1") return false;
  if (isProductionSettlementChain(env)) return false;
  return true;
}

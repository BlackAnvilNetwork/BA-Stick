/**
 * Client scaffolding for “pay from home chain” EEZ sync buys.
 * Today all buys go through ah-buy.ts on the game chain.
 */
export type HomeChainOption = {
  chainId: number;
  label: string;
  rpcUrl: string;
};

/** Future: populate from server snapshot once LOK_EEZ_* is configured. */
export function listHomeChainOptions(): HomeChainOption[] {
  return [];
}

export function eezSyncBuyAvailable(): boolean {
  return false;
}

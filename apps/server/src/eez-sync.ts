/**
 * EEZ sync-buy scaffolding (not wired to live fills yet).
 *
 * Local AhEscrow.buyAsk{value} remains the play path. When zone registration
 * lands, home-chain payments should result in the same AskFilled watcher path.
 */
export type EezZoneConfig = {
  /** EEZ rollup / zone id once registered. */
  zoneId: string | null;
  /** Home-chain RPC the client may use for sync value. */
  homeRpcUrl: string | null;
  /** Game-chain AhEscrow already configured separately via LOK_AH_ESCROW. */
  syncBuyEnabled: boolean;
};

export function eezZoneConfig(env: NodeJS.ProcessEnv = process.env): EezZoneConfig {
  const zoneId = env.LOK_EEZ_ZONE_ID?.trim() || null;
  const homeRpcUrl = env.LOK_EEZ_HOME_RPC?.trim() || null;
  return {
    zoneId,
    homeRpcUrl,
    // Explicit opt-in until registration + proxy path are production-ready.
    syncBuyEnabled: env.LOK_EEZ_SYNC_BUY === "1" && !!zoneId,
  };
}

/**
 * Placeholder: map a home-chain payment intent to an AhEscrow.buyAsk call on the
 * game domain via EEZ CrossChainProxy. Not implemented — returns a clear error.
 */
export function planEezSyncBuy(_opts: {
  listingId: string;
  priceWei: string;
  buyerTokenId: string;
  homeChainId: number;
}): { ok: false; error: string } {
  return {
    ok: false,
    error:
      "EEZ sync buy is not wired yet. Use the local AhEscrow browser buy (ah-buy.ts). " +
      "Set LOK_EEZ_ZONE_ID + LOK_EEZ_SYNC_BUY=1 only after zone registration.",
  };
}

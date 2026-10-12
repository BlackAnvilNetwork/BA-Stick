/**
 * Fungible catalog slugs safe to register on Items (REGISTRAR) at launch.
 * `kind: "base"` = gather/drop materials used by craft recipes and baseMats.
 * Chain id = chainFungibleId(slug). New types later = registerFungible only.
 */
import { CATALOG, CATALOG_BY_ID } from "./catalog.generated";
import { chainFungibleId, chainFungibleIdHex } from "./chain-ids";

/** All base-material slugs (stable, sorted). */
export const EXPORTABLE_BASE_SLUGS: readonly string[] = Object.freeze(
  CATALOG.filter((i) => i.kind === "base")
    .map((i) => i.slug)
    .sort((a, b) => a.localeCompare(b)),
);

/** Default seed for DeployItems ITEMS_SEED_SLUGS (comma-separated). */
export function itemsSeedSlugsCsv(slugs: readonly string[] = EXPORTABLE_BASE_SLUGS): string {
  return slugs.join(",");
}

export type ExportableFungible = {
  slug: string;
  chainId: bigint;
  chainIdHex: `0x${string}`;
};

export function exportableFungibles(
  slugs: readonly string[] = EXPORTABLE_BASE_SLUGS,
): ExportableFungible[] {
  return slugs.map((slug) => ({
    slug,
    chainId: chainFungibleId(slug),
    chainIdHex: chainFungibleIdHex(slug),
  }));
}

/** Resolve catalog small-int id → chain fungible id when the def has a slug. */
export function catalogIdToChainFungibleId(catalogId: number): bigint | null {
  const def = CATALOG_BY_ID[catalogId];
  if (!def?.slug) return null;
  return chainFungibleId(def.slug);
}

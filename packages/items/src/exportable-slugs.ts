/**
 * Fungible catalog slugs safe to register on Items (REGISTRAR) at launch.
 *
 * Launch seed = Pale Hollow live gather/drop bases only (plus Desiccated Hide).
 * Registering all `kind: "base"` slugs would mint on-chain ids for mats that
 * cannot be obtained in-game yet (Ashlands / Slagpits / …).
 *
 * Equipment is NOT exportable at launch: unique-id mint path is deferred.
 * Chain export of equipment stays off until `registerUnique` / instance ids
 * are wired; log-bag export of equipment catalog ids remains server-local.
 */
import { CATALOG, CATALOG_BY_ID } from "./catalog.generated";
import { chainFungibleId, chainFungibleIdHex } from "./chain-ids";

/** Pale Hollow obtainable bases (+ desiccated-hide). Sorted. */
export const LIVE_BASE_SLUGS: readonly string[] = Object.freeze([
  "antidote-root",
  "ashbeam-log",
  "bark-strip",
  "bone-chip",
  "clay-crab",
  "climbing-cord",
  "cobble",
  "copper-ore",
  "cracked-brick",
  "dead-fiber",
  "desiccated-hide",
  "dustgrain",
  "fossil-minnow",
  "horn",
  "limestone",
  "linen-scrap",
  "pale-dust",
  "pale-flax",
  "potters-clay",
  "river-sand",
  "rock-salt",
  "slime-oil",
  "soft-pelt",
  "tin-ore",
]);

/**
 * Launch Items.sol seed — live bases only.
 * @deprecated Prefer LIVE_BASE_SLUGS; kept as the DeployItems default name.
 */
export const EXPORTABLE_BASE_SLUGS: readonly string[] = LIVE_BASE_SLUGS;

/** Every `kind: "base"` slug (for audits / future zones — not the launch seed). */
export const ALL_BASE_SLUGS: readonly string[] = Object.freeze(
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

/**
 * Resolve catalog small-int id → chain fungible id for **launch-exportable** bases only.
 * Equipment / other kinds return null (no Items mint path yet).
 */
export function catalogIdToChainFungibleId(catalogId: number): bigint | null {
  if (!isLaunchExportableFungible(catalogId)) return null;
  const def = CATALOG_BY_ID[catalogId];
  if (!def?.slug) return null;
  return chainFungibleId(def.slug);
}

/** True when this catalog id may be registered / bridged as a fungible on Items. */
export function isLaunchExportableFungible(catalogId: number): boolean {
  const def = CATALOG_BY_ID[catalogId];
  if (!def || def.kind !== "base") return false;
  return (LIVE_BASE_SLUGS as readonly string[]).includes(def.slug);
}


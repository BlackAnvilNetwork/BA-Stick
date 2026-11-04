/**
 * Fail-closed boot gates for Gnosis / Chiado production.
 * Missing contracts or dry-run addresses → refuse to listen.
 */
import { createPublicClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { findDryRunEnvHits, dryRunDeployAllowed } from "./dry-run-denylist";
import { listingRoleKey, ahEscrowAddress } from "./ah-escrow";
import { characterMintEnvConfigured } from "./lok-vault";
import { assertPublicRpcSafe } from "./public-rpc";
import { envSettlementChainId } from "./settlement-chain";

/**
 * Abandoned 2026-10-13 EOA-direct listing pin. Official ignition does not
 * accept this as a listing signer: Listing Safe holds the roles; LOK_LISTING_KEY
 * is an owner of that Safe. Other modules still import this address.
 */
export const PINNED_GNOSIS_LISTING_ADDRESS = "0xbfa29a6ee3d1188aa0a9e0c783e5da620b859e76";
/** Official Listing Safe (deployments/gnosis.json listingRole). Admin is 0x9f26…6c34. */
export const PINNED_GNOSIS_LISTING_SAFE = "0xe10520c6122c01edd91403d98da9578c0ce5002b";

/** Same shape listingRoleKey accepts — 0x + 32-byte hex. */
const LISTING_KEY_HEX = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS_HEX = /^0x[0-9a-fA-F]{40}$/;

export type ProductionBootResult =
  | { ok: true }
  | { ok: false; error: string };

const ESCROW_ABI = parseAbi([
  "function characterNft() view returns (address)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function LISTING_ROLE() view returns (bytes32)",
]);
const PVP_BOUNTY_ABI = parseAbi([
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function OPERATOR_ROLE() view returns (bytes32)",
  "function claimDelay() view returns (uint256)",
]);

/** Production propose/execute bounties must leave a guardian a window to veto. */
export const PVP_PRODUCTION_CLAIM_DELAY_MIN = 60n;
/** Matches `PvpBounty` constructor cap. */
export const PVP_PRODUCTION_CLAIM_DELAY_MAX = 7n * 24n * 60n * 60n;

export function assertPvpProductionClaimDelay(delay: bigint): ProductionBootResult {
  if (delay < PVP_PRODUCTION_CLAIM_DELAY_MIN) {
    return {
      ok: false,
      error:
        "PvpBounty.claimDelay " +
        delay.toString() +
        "s is below the production minimum of 60s",
    };
  }
  if (delay > PVP_PRODUCTION_CLAIM_DELAY_MAX) {
    return {
      ok: false,
      error: "PvpBounty.claimDelay " + delay.toString() + "s exceeds 7 days",
    };
  }
  return { ok: true };
}
const FACTORY_ABI = parseAbi(["function mintFee() view returns (uint256)"]);
const SAFE_OWNERS_ABI = parseAbi(["function getOwners() view returns (address[])"]);

function namedNetwork(env: NodeJS.ProcessEnv): string {
  return (env.NETWORK ?? env.LOK_NETWORK)?.trim().toLowerCase() ?? "";
}

function chainIsGnosis(env: NodeJS.ProcessEnv = process.env, chainId = envSettlementChainId(env)): boolean {
  return namedNetwork(env) === "gnosis" || chainId === 100;
}

/** Operator RPC: LOK_CHAIN_RPC, else first LOK_CHAIN_RPC_URLS entry, else public. */
function firstOperatorRpc(env: NodeJS.ProcessEnv = process.env): string {
  const primary = env.LOK_CHAIN_RPC?.trim() ?? "";
  if (primary) return primary;
  const raw = env.LOK_CHAIN_RPC_URLS?.trim() ?? "";
  if (raw) {
    for (const part of raw.split(",")) {
      const url = part.trim();
      if (url) return url;
    }
  }
  return env.LOK_PUBLIC_RPC?.trim() ?? "";
}

function envForMintShape(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  if (env.LOK_CHAIN_RPC?.trim()) return env;
  const rpc = firstOperatorRpc(env);
  if (!rpc) return env;
  return { ...env, LOK_CHAIN_RPC: rpc };
}

/**
 * On Gnosis the listing key must be an owner of LOK_LISTING_SAFE, and that Safe
 * must be the official Listing Safe that holds LISTING / OPERATOR. The abandoned
 * EOA pin is not a fallback when the Safe is unset.
 */
export function gnosisListingSignerOk(args: {
  chainIsGnosis: boolean;
  keyAddress: string;
  keyHasListingRole: boolean;
  keyHasOperatorRole: boolean;
  listingSafe?: string;
  safeHasListingRole?: boolean;
  safeHasOperatorRole?: boolean;
  safeOwners?: readonly string[];
}): ProductionBootResult {
  const key = args.keyAddress.toLowerCase();
  const safe = args.listingSafe?.trim().toLowerCase() ?? "";
  if (args.chainIsGnosis && !safe) {
    return {
      ok: false,
      error:
        "production Gnosis requires LOK_LISTING_SAFE (official Listing Safe " +
        PINNED_GNOSIS_LISTING_SAFE +
        ") — abandoned EOA pin " +
        PINNED_GNOSIS_LISTING_ADDRESS +
        " is not accepted",
    };
  }
  if (safe) {
    if (args.chainIsGnosis && safe !== PINNED_GNOSIS_LISTING_SAFE) {
      return {
        ok: false,
        error: "LOK_LISTING_SAFE " + safe + " != pinned official Listing Safe " + PINNED_GNOSIS_LISTING_SAFE,
      };
    }
    if (!args.safeHasListingRole) {
      return { ok: false, error: "Listing Safe " + safe + " lacks LISTING_ROLE on AhEscrow" };
    }
    if (!args.safeHasOperatorRole) {
      return { ok: false, error: "Listing Safe " + safe + " lacks OPERATOR_ROLE on PvpBounty" };
    }
    const owners = (args.safeOwners ?? []).map((owner) => owner.toLowerCase());
    if (!owners.includes(key)) {
      return {
        ok: false,
        error: "LOK_LISTING_KEY address " + args.keyAddress + " is not an owner of Listing Safe " + safe,
      };
    }
    return { ok: true };
  }
  if (!args.keyHasListingRole) {
    return { ok: false, error: "LOK_LISTING_KEY address " + args.keyAddress + " lacks LISTING_ROLE on AhEscrow" };
  }
  if (!args.keyHasOperatorRole) {
    return { ok: false, error: "LOK_LISTING_KEY address " + args.keyAddress + " lacks OPERATOR_ROLE on PvpBounty" };
  }
  return { ok: true };
}

export function isProductionSettlementChain(env: NodeJS.ProcessEnv = process.env): boolean {
  const named = namedNetwork(env);
  if (named === "gnosis" || named === "chiado") return true;
  const id = envSettlementChainId(env);
  return id === 100 || id === 10200;
}

/**
 * Synchronous env shape check (no RPC). Call after applySettlementDeployFile.
 */
export function assertProductionEnvShape(env: NodeJS.ProcessEnv = process.env): ProductionBootResult {
  if (!isProductionSettlementChain(env)) return { ok: true };

  const hits = findDryRunEnvHits(env);
  if (hits.length > 0 && !dryRunDeployAllowed(env)) {
    return {
      ok: false,
      error:
        "dry-run denylist hit: " +
        hits.map((h) => h.key + "=" + h.address).join(", ") +
        " — refuse production boot (see deployments/gnosis-dryrun.json)",
    };
  }

  const nft = env.LOK_NFT?.trim();
  const factory = env.LOK_FACTORY?.trim();
  const escrow = env.LOK_AH_ESCROW?.trim() || ahEscrowAddress(env);
  const rpc = firstOperatorRpc(env);
  const listingKeyRaw = env.LOK_LISTING_KEY?.trim() || "";
  const statusToken = env.LOK_OPS_STATUS_TOKEN?.trim();
  const pvpBounty = env.LOK_PVP_BOUNTY?.trim() || "";
  const listingSafe = env.LOK_LISTING_SAFE?.trim() || "";
  const gnosis = chainIsGnosis(env);

  // Admin / deployer keys must never sit on a production host. LISTING covers
  // AhEscrow LISTING_ROLE + PvpBounty OPERATOR_ROLE.
  if (env.LOK_OWNER_KEY?.trim()) {
    return {
      ok: false,
      error:
        "LOK_OWNER_KEY must not be set on production settlement chains — use LOK_LISTING_KEY only (LISTING EOA)",
    };
  }
  if (env.PRIVATE_KEY?.trim()) {
    return {
      ok: false,
      error:
        "PRIVATE_KEY must not be set on production settlement chains — use LOK_LISTING_KEY only (LISTING EOA)",
    };
  }

  const missing: string[] = [];
  if (!nft) missing.push("LOK_NFT");
  if (!factory) missing.push("LOK_FACTORY");
  if (!escrow) missing.push("LOK_AH_ESCROW");
  if (!rpc) missing.push("LOK_CHAIN_RPC");
  // LISTING EOA only — never put admin/owner keys on the server for AhEscrow or PvpBounty.
  if (!listingKeyRaw) missing.push("LOK_LISTING_KEY");
  if (!statusToken) missing.push("LOK_OPS_STATUS_TOKEN");
  if (!ADDRESS_HEX.test(pvpBounty)) missing.push("LOK_PVP_BOUNTY");
  if (gnosis && !ADDRESS_HEX.test(listingSafe)) missing.push("LOK_LISTING_SAFE");
  if (missing.length) {
    return {
      ok: false,
      error:
        "production settlement chain requires " +
        missing.join(", ") +
        " (mint must not fail open). Dry-run deploy JSON is not used for auto-fill.",
    };
  }
  if (listingKeyRaw && !LISTING_KEY_HEX.test(listingKeyRaw)) {
    return {
      ok: false,
      error: "LOK_LISTING_KEY must be a 0x-prefixed 64-hex private key",
    };
  }
  if (!listingRoleKey(env)) {
    return {
      ok: false,
      error: "LOK_LISTING_KEY must be a 0x-prefixed 64-hex private key",
    };
  }
  if (gnosis && listingSafe.toLowerCase() !== PINNED_GNOSIS_LISTING_SAFE) {
    return {
      ok: false,
      error:
        "LOK_LISTING_SAFE " +
        listingSafe +
        " != pinned official Listing Safe " +
        PINNED_GNOSIS_LISTING_SAFE,
    };
  }
  if (!characterMintEnvConfigured(envForMintShape(env))) {
    return { ok: false, error: "character mint env incomplete on production chain" };
  }
  // #272: snapshots must never embed keyed operator RPCs.
  const pub = assertPublicRpcSafe(env);
  if (!pub.ok) return pub;
  return { ok: true };
}

/**
 * On-chain smoke: bytecode present, mintFee > 0, escrow.characterNft == NFT,
 * LISTING / OPERATOR held by Listing Safe (Gnosis) or the listing key (Chiado).
 */
export async function assertProductionContractsLive(
  env: NodeJS.ProcessEnv = process.env,
): Promise<ProductionBootResult> {
  if (!isProductionSettlementChain(env)) return { ok: true };
  const shape = assertProductionEnvShape(env);
  if (!shape.ok) return shape;

  const nft = env.LOK_NFT!.trim() as `0x${string}`;
  const factory = env.LOK_FACTORY!.trim() as `0x${string}`;
  const escrow = (env.LOK_AH_ESCROW?.trim() || ahEscrowAddress(env)) as `0x${string}`;
  const rpc = firstOperatorRpc(env);
  const listing = listingRoleKey(env);
  const chainId = envSettlementChainId(env);

  try {
    const pub = createPublicClient({
      chain: {
        id: chainId,
        name: "settlement",
        nativeCurrency: { name: "xDAI", symbol: "xDAI", decimals: 18 },
        rpcUrls: { default: { http: [rpc] } },
      },
      transport: http(rpc),
    });
    const bounty = (env.LOK_PVP_BOUNTY?.trim() || "") as `0x${string}`;
    for (const [label, addr] of [
      ["NFT", nft],
      ["Factory", factory],
      ["AhEscrow", escrow],
      ["PvpBounty", bounty],
    ] as const) {
      const code = await pub.getBytecode({ address: addr });
      if (!code || code === "0x") {
        return { ok: false, error: label + " has no bytecode at " + addr };
      }
    }
    let claimDelay: bigint;
    try {
      claimDelay = await pub.readContract({
        address: bounty,
        abi: PVP_BOUNTY_ABI,
        functionName: "claimDelay",
      });
    } catch {
      return {
        ok: false,
        error:
          "PvpBounty at " +
          bounty +
          " has no claimDelay — redeploy the propose/execute contract (single-claim bytecode cannot be used)",
      };
    }
    const delayOk = assertPvpProductionClaimDelay(claimDelay);
    if (!delayOk.ok) return delayOk;
    const fee = await pub.readContract({
      address: factory,
      abi: FACTORY_ABI,
      functionName: "mintFee",
    });
    if (fee <= 0n) {
      return { ok: false, error: "CharacterFactory.mintFee is 0 — refuse free mint" };
    }
    const escrowNft = (
      await pub.readContract({
        address: escrow,
        abi: ESCROW_ABI,
        functionName: "characterNft",
      })
    ).toLowerCase();
    if (escrowNft !== nft.toLowerCase()) {
      return {
        ok: false,
        error: "AhEscrow.characterNft (" + escrowNft + ") != LOK_NFT (" + nft.toLowerCase() + ")",
      };
    }
    if (!listing) {
      return { ok: false, error: "LOK_LISTING_KEY must be a 0x-prefixed 64-hex private key" };
    }
    try {
      const role = await pub.readContract({
        address: escrow,
        abi: ESCROW_ABI,
        functionName: "LISTING_ROLE",
      });
      const acct = privateKeyToAccount(
        (listing.startsWith("0x") ? listing : "0x" + listing) as `0x${string}`,
      );
      const gnosis = chainIsGnosis(env, chainId);
      const opRole = await pub.readContract({
        address: bounty,
        abi: PVP_BOUNTY_ABI,
        functionName: "OPERATOR_ROLE",
      });
      const listingSafeRaw = env.LOK_LISTING_SAFE?.trim() ?? "";
      if (ADDRESS_HEX.test(listingSafeRaw)) {
        const safe = listingSafeRaw as `0x${string}`;
        const [safeHasListingRole, safeHasOperatorRole, safeOwners] = await Promise.all([
          pub.readContract({
            address: escrow,
            abi: ESCROW_ABI,
            functionName: "hasRole",
            args: [role, safe],
          }),
          pub.readContract({
            address: bounty,
            abi: PVP_BOUNTY_ABI,
            functionName: "hasRole",
            args: [opRole, safe],
          }),
          pub.readContract({
            address: safe,
            abi: SAFE_OWNERS_ABI,
            functionName: "getOwners",
          }),
        ]);
        const decision = gnosisListingSignerOk({
          chainIsGnosis: gnosis,
          keyAddress: acct.address,
          keyHasListingRole: false,
          keyHasOperatorRole: false,
          listingSafe: safe,
          safeHasListingRole,
          safeHasOperatorRole,
          safeOwners,
        });
        if (!decision.ok) return decision;
      } else {
        const keyHasListingRole = await pub.readContract({
          address: escrow,
          abi: ESCROW_ABI,
          functionName: "hasRole",
          args: [role, acct.address],
        });
        const keyHasOperatorRole = await pub.readContract({
          address: bounty,
          abi: PVP_BOUNTY_ABI,
          functionName: "hasRole",
          args: [opRole, acct.address],
        });
        const decision = gnosisListingSignerOk({
          chainIsGnosis: gnosis,
          keyAddress: acct.address,
          keyHasListingRole,
          keyHasOperatorRole,
        });
        if (!decision.ok) return decision;
      }
    } catch (err) {
      return {
        ok: false,
        error:
          "LISTING_ROLE check failed: " +
          (err instanceof Error ? err.message : String(err)),
      };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: "production contract smoke failed: " + (err instanceof Error ? err.message : String(err)),
    };
  }
}

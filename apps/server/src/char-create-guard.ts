/**
 * Mint-first character create guards.
 * Binding an existing NFT uses the on-chain genesis job, not the client's job,
 * so the log spawn matches CharacterCheckpoint and later checkpoints do not
 * hit SpawnMismatch / StaleRoot.
 */
import { JOB_IDS, type JobId } from "@bellgrave/combat";

/** Gnosis mainnet and Chiado. Free mints are refused on these chains. */
export const PRODUCTION_MINT_CHAIN_IDS = [100, 10200] as const;

export function jobFromIndex(jobIndex: number): JobId | null {
  if (!Number.isInteger(jobIndex) || jobIndex < 0 || jobIndex >= JOB_IDS.length) return null;
  return JOB_IDS[jobIndex] ?? null;
}

/**
 * Spawn job for a bindToken create. The client job is ignored.
 * A missing or unknown genesis job is an error (do not fall back to the client).
 */
export function resolveBindSpawnJob(opts: {
  genesisJob: number | null;
  genesisError?: string;
}): { ok: true; jobIndex: number; job: JobId } | { ok: false; error: string } {
  if (opts.genesisJob == null) {
    return {
      ok: false,
      error: opts.genesisError ?? "Character has no on-chain genesis job.",
    };
  }
  const job = jobFromIndex(opts.genesisJob);
  if (!job) {
    return {
      ok: false,
      error: "On-chain genesis job " + String(opts.genesisJob) + " is not a playable job.",
    };
  }
  return { ok: true, jobIndex: opts.genesisJob, job };
}

/** Refuse mint-first create when a production chain is advertising a zero mint fee. */
export function refuseZeroMintFee(
  chainId: number,
  mintFee: string,
): { ok: true } | { ok: false; error: string } {
  if (!PRODUCTION_MINT_CHAIN_IDS.includes(chainId as (typeof PRODUCTION_MINT_CHAIN_IDS)[number])) {
    return { ok: true };
  }
  let fee: bigint;
  try {
    fee = BigInt(mintFee);
  } catch {
    return { ok: false, error: "Character mint fee is unreadable. Creates are blocked." };
  }
  if (fee <= 0n) {
    return {
      ok: false,
      error: "Character mint fee is 0 on this chain. Creates are blocked until the fee is restored.",
    };
  }
  return { ok: true };
}

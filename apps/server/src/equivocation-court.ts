/**
 * Local equivocation court.
 *
 * Two validly signed batches from the same signer for the same epoch and
 * height with different next roots are proof of equivocation. Anyone may
 * submit that pair. The slash is the bond already posted for that signer,
 * written to zero through `notePostedSlashableBond`, so `slashable-bonds.json`
 * records zero for that signer. A signer with no posted bond, or a posted
 * bond of zero, is not slashed, and no amount is invented.
 *
 * An admin vote, a multisig approval, or a social vote cannot slash without
 * that pair and cannot refuse a pair that slashes a posted bond. This module
 * does not broadcast. Gnosis mainnet and Chiado are not called. Submitting a
 * pair does not stop the 20 Hz tick.
 *
 * A signer who joined the voting set by that bond leaves the set when the
 * bond is written to zero. The Gnosis Safe stays admin. The threshold stays
 * a majority.
 */
import { timingSafeEqual } from "node:crypto";
import { HASH_BYTES, leaderSignatureValid, type BatchEnvelope } from "./batch-envelope";
import { removeSlashedVotingReplica } from "./bonded-admission";
import { notePostedSlashableBond, postedSlashableBond } from "./root-anchor";

/** A vote a caller may attach. The court does not read it. */
export type CourtBallot = {
  admin?: boolean;
  multisig?: boolean;
  social?: boolean;
};

export type CourtResult = { slashed: true; amountWei: bigint } | { slashed: false };

/**
 * Amount written to zero for a signer in this process. The slash itself is
 * the posted bond file. A missing bond or a zero bond is never entered.
 */
const slashedAmount = new Map<string, bigint>();

export function resetEquivocationCourtForTests(): void {
  slashedAmount.clear();
}

/** Lowercase hex of the signer key. Posted bonds for that signer use this id. */
export function equivocationSignerId(signer: Uint8Array): string {
  return Buffer.from(signer).toString("hex");
}

/**
 * Bond written to zero for this signer. Absent when no posted bond was slashed.
 */
export function signerSlash(signer: Uint8Array): CourtResult {
  const amountWei = slashedAmount.get(equivocationSignerId(signer));
  if (amountWei == null || amountWei <= 0n) return { slashed: false };
  return { slashed: true, amountWei };
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function root32(root: Uint8Array): boolean {
  return root instanceof Uint8Array && root.length === HASH_BYTES;
}

function sameSlot(left: BatchEnvelope, right: BatchEnvelope): boolean {
  return (
    Number.isInteger(left.epoch) &&
    left.epoch >= 0 &&
    left.epoch === right.epoch &&
    Number.isInteger(left.height) &&
    left.height >= 0 &&
    left.height === right.height
  );
}

function evidenceReproduces(left: BatchEnvelope, right: BatchEnvelope, signer: Uint8Array): boolean {
  if (!sameSlot(left, right)) return false;
  if (!root32(left.nextRoot) || !root32(right.nextRoot)) return false;
  if (bytesEqual(left.nextRoot, right.nextRoot)) return false;
  if (!leaderSignatureValid(left, signer)) return false;
  if (!leaderSignatureValid(right, signer)) return false;
  return true;
}

/**
 * Anyone may submit the pair. `ballot` is ignored: a vote cannot slash, and
 * a vote cannot keep a pair that slashes a posted bond from slashing.
 * The slash is that signer's posted bond, written down to zero.
 */
export function submitEquivocationPair(
  left: BatchEnvelope,
  right: BatchEnvelope,
  signer: Uint8Array,
  ballot?: CourtBallot,
): CourtResult {
  void ballot;
  if (!evidenceReproduces(left, right, signer)) return { slashed: false };
  const id = equivocationSignerId(signer);
  const amountWei = postedSlashableBond(id);
  if (amountWei <= 0n) return { slashed: false };
  notePostedSlashableBond(id, 0n);
  removeSlashedVotingReplica(id);
  slashedAmount.set(id, amountWei);
  return { slashed: true, amountWei };
}

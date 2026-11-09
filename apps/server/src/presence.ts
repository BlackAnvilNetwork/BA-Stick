/**
 * A character is present when the journal has its spawn, or when a mint has
 * been seen and the observer's cursor has not passed that mint yet.
 * The bind file, the roster, and the checkpoint summary do not decide this.
 * The summary is a witness: a higher on-chain level refuses the character,
 * and it cannot rebuild one.
 */
export type CharacterPresence =
  | { kind: "on-journal" }
  | { kind: "absent" }
  | { kind: "pending-mint"; mintBlock: bigint; scannedTo: bigint };

export function characterPresence(args: {
  inJournal: boolean;
  mintBlock: bigint | null;
  scannedTo: bigint | null;
}): CharacterPresence {
  if (args.inJournal) return { kind: "on-journal" };
  if (args.mintBlock != null && args.scannedTo != null && args.scannedTo < args.mintBlock) {
    return { kind: "pending-mint", mintBlock: args.mintBlock, scannedTo: args.scannedTo };
  }
  return { kind: "absent" };
}

/**
 * Missing history is one token whose mint block is behind the cursor and
 * which still has no spawn. A mint the cursor has not reached stays pending.
 * A finished scan that never saw a mint, and whose cursor has reached the
 * chain tip, is also missing history: there is no unprocessed block left.
 */
export function mintBecomesMissingHistory(args: {
  inJournal: boolean;
  scanComplete: boolean;
  mintBlock: bigint | null;
  scannedTo: bigint;
  tip: bigint;
}): boolean {
  if (args.inJournal) return false;
  if (!args.scanComplete) return false;
  if (args.mintBlock == null) return args.scannedTo >= args.tip;
  return args.scannedTo >= args.mintBlock;
}

/** Witness only. Summary level 0 has no checkpoint. Level 1 does not trip a level-1 journal. */
export function summaryAheadOfJournal(summaryLevel: number, journalLevel: number): boolean {
  if (!Number.isFinite(summaryLevel) || summaryLevel <= 0) return false;
  const local = Math.max(1, journalLevel);
  return summaryLevel > local;
}

export function summaryWitnessAhead(summaryLevel: number, journalLevel: number): boolean {
  return summaryAheadOfJournal(summaryLevel, journalLevel);
}

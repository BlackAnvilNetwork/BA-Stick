/** A reconnect mid-create must keep auto-enter; only idle auth/ok may drop the flag. */
export function shouldClearPendingCreateEnterOnAuthOk(pendingCreateEnter: boolean): boolean {
  return !pendingCreateEnter;
}

/** Roster id added after char/create — enter that one, not an older primary. */
export function createEnterIdAfterAuthOk(
  pendingCreateEnter: boolean,
  prevIds: readonly string[],
  nextIds: readonly string[],
): string | null {
  if (!pendingCreateEnter) return null;
  const prev = new Set(prevIds);
  for (let i = nextIds.length - 1; i >= 0; i--) {
    const id = nextIds[i];
    if (id && !prev.has(id)) return id;
  }
  return null;
}

/** claim/starter waits for the create snapshot, not a 100ms guess. */
export function shouldClaimStarterOnSnapshot(pendingCreateEnter: boolean): boolean {
  return pendingCreateEnter;
}

/** Select / cancelled create: roster only — do not jump selection or paint play HUD. */
export function shouldApplyCreateSnapshotHud(phase: string, pendingCreateEnter: boolean): boolean {
  if (phase === "play") return true;
  if (phase === "select") return false;
  return pendingCreateEnter;
}

/** Mid-create reconnect with no new roster id must stay on create so the mint timer lives. */
export function shouldStayOnCreateAfterAuthOk(
  pendingCreateEnter: boolean,
  createEnterId: string | null,
): boolean {
  return pendingCreateEnter && createEnterId == null;
}

/** Empty roster on a mint chain — ask the server to bind Character NFTs this wallet already owns. */
export function shouldRequestOwnedNftSync(opts: {
  rosterCount: number;
  hasMintConfig: boolean;
}): boolean {
  return opts.rosterCount === 0 && opts.hasMintConfig;
}

export function phaseAfterOwnedRoster(opts: {
  rosterCount: number;
  pendingCreateEnter: boolean;
  phase: string;
}): "select" | "create" | "keep" {
  if (opts.phase === "play") return "keep";
  if (opts.rosterCount > 0) return "select";
  if (opts.pendingCreateEnter) return "keep";
  return "create";
}

/** Zone hand-off drops the NPC menu so the first Escape is not a ghost close. */
export function npcDialogAfterSnapshot<T>(
  prevZone: string | undefined,
  nextZone: string | undefined,
  npcDialog: T | null,
): T | null {
  if (prevZone != null && nextZone != null && prevZone !== nextZone) return null;
  return npcDialog;
}

export function shouldRefuseLeftoverBurnerSession(
  wallet: string | null | undefined,
  leftover: boolean,
): boolean {
  return !!wallet && leftover;
}

/** Leftover burner is refused even when characterMint.chainId is missing. */
export function shouldKickLeftoverBurnerOnAuthOk(leftover: boolean): boolean {
  return leftover;
}

/** hydrateAuthSession must clear a dead in-memory token when the row has none. */
export function hydratedResumeToken(sessionToken: string | null | undefined): string | null {
  return sessionToken ?? null;
}

export function shouldAllowSilentHello(
  reason: "resume-miss" | "auth-ok" | "restore" | "login",
): boolean {
  return reason === "resume-miss";
}

/** No second hello while a challenge for this address is already outstanding. */
export function shouldBeginAuthHello(opts: {
  address: string;
  authInFlight: boolean;
  authInFlightWallet: string | null;
  alreadyAuthed?: boolean;
  force?: boolean;
}): boolean {
  const addr = opts.address.toLowerCase();
  if (opts.authInFlight && opts.authInFlightWallet?.toLowerCase() === addr) return false;
  if (opts.authInFlight && !opts.force) return false;
  if (opts.alreadyAuthed && !opts.force) return false;
  return true;
}

/** Live AppKit / injected address wins over a persisted leftover or other wallet. */
export function shouldAdoptLiveWallet(
  live: string | null | undefined,
  persisted: string | null | undefined,
): boolean {
  if (!live || !persisted) return false;
  return live.toLowerCase() !== persisted.toLowerCase();
}

/** Drop the previous game session when AppKit reports a different account. */
export function shouldResetSessionOnWalletSwitch(
  prev: string | null | undefined,
  next: string | null | undefined,
): boolean {
  if (!next || !prev) return false;
  return prev.toLowerCase() !== next.toLowerCase();
}

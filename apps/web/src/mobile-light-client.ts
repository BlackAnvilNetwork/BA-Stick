/**
 * Mobile light client for one character.
 *
 * A phone runs the light tier. It does not start the world tick, does not
 * lead, and does not become a replica. Plugged-in and unmetered are not a
 * second mode. The power and background policy is a later box.
 *
 * Verification is `checkWebLightClient`, in that order: replica commit
 * certificate, then the character root, then one state leaf. This module does
 * not keep a second verifier. A leader signature is not a certificate because
 * the web check rejects it.
 *
 * A failed certificate is not stored as the committed view. A failed character
 * root does not store the leaf. An empty character-root tree stays 32 zero
 * bytes, which is the web check's empty tree.
 */
import { checkWebLightClient, type WebLightPayload, type WebLightResult } from "./light-client";

export type MobileEntry = {
  tier: "light";
  ticksWorld: false;
  leads: false;
  replica: false;
};

export type MobileCommitted = Extract<WebLightResult, { ok: true }>;

export type MobileLightView = {
  committed: MobileCommitted | null;
};

export type MobileLightClient = {
  readonly entry: MobileEntry;
  view(): MobileLightView;
  accept(payload: WebLightPayload): MobileLightView;
};

const LIGHT: MobileEntry = {
  tier: "light",
  ticksWorld: false,
  leads: false,
  replica: false,
};

/**
 * Phone boot. The light tier never starts the world tick.
 * `startWorldTick` runs only if this entry were a ticking replica, which it is not.
 */
export function mobileEntry(startWorldTick?: () => void): MobileEntry {
  const entry: MobileEntry = { ...LIGHT };
  if (startsWorldTick(entry)) startWorldTick?.();
  return entry;
}

/** A phone client. Each call is its own committed view. The entry is light. */
export function createMobileLightClient(startWorldTick?: () => void): MobileLightClient {
  const entry = mobileEntry(startWorldTick);
  let committed: MobileCommitted | null = null;
  return {
    entry,
    view: () => ({ committed }),
    accept(payload) {
      const verdict = checkWebLightClient(payload);
      committed = verdict.ok ? verdict : null;
      return { committed };
    },
  };
}

function startsWorldTick(entry: MobileEntry): boolean {
  return entry.ticksWorld && entry.leads && entry.replica;
}

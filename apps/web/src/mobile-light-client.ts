/**
 * Mobile light client for one character.
 *
 * A phone is not a default replica. Boot stays the light tier. It does not
 * start the world tick, does not lead, and does not become a replica.
 *
 * A limited validator mode is eligible only when the device is both plugged
 * in and on an unmetered connection. Unplugged, or metered, stays light.
 * Eligibility does not start the world tick. Background limits on the mobile
 * OS apply, so the eligible mode is best-effort and may be stopped by the OS.
 * This module sets no CPU, RAM, or disk floor. The mode grants no combat
 * bonus, no second guild, and not the listing key.
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

/** Power and network the phone reports. Both must hold for eligibility. */
export type MobilePower = {
  pluggedIn: boolean;
  /** False on a metered connection. */
  unmetered: boolean;
};

/**
 * Limited validator mode is eligible only when the device is plugged in and
 * the connection is unmetered. Unplugged, or metered, is not eligible.
 * Eligibility is not boot: it does not tick, lead, or make the phone a replica.
 * Background limits still apply, so an eligible mode is best-effort and the OS
 * may stop it. No CPU, RAM, or disk floor is applied. The mode grants no
 * combat bonus, no second guild, and not the listing key.
 */
export function mobileLimitedValidatorEligible(power: MobilePower): boolean {
  return power.pluggedIn === true && power.unmetered === true;
}

/**
 * Phone boot. The light tier never starts the world tick.
 * `startWorldTick` runs only if this entry were a ticking replica, which it is not.
 * `mobileLimitedValidatorEligible` does not change this result.
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

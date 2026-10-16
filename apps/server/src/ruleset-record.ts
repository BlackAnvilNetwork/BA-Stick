/**
 * Active ruleset record: the wasm pin and the SP1 verifying key.
 *
 * The wasm digest stays `LOCAL_RULESET_WASM_SHA256`. The verifying key starts
 * as `LOCAL_SP1_VERIFYING_KEY` and changes only after `RulesetRegistry.MIN_DELAY`
 * (one day). `setVerifyingKey` does not change the key a batch is checked
 * against until that delay has elapsed.
 *
 * A proof under any other key is not a batch of this world. When a batch
 * carries a proof, that proof is checked against replay of the pinned wasm.
 * A disagreement ignores the proof and the batch is invalid. This module
 * still decides only whether the verifying key is the active pin.
 */
import { LOCAL_RULESET_WASM_SHA256, LOCAL_SP1_VERIFYING_KEY, type RulesetRecord } from "./lok-vault";

/** One day. `RulesetRegistry.MIN_DELAY`. Not `PvpBounty.claimDelay`. */
export const RULESET_MIN_DELAY_MS = 24 * 60 * 60 * 1000;

type PendingKey = { verifyingKey: string; activatesAt: number };

let activeVerifyingKey = LOCAL_SP1_VERIFYING_KEY;
let pending: PendingKey | null = null;
let nowMs: () => number = () => Date.now();

/** Tests advance this instead of waiting out the day. Production uses `Date.now`. */
export function setRulesetClockForTests(now: () => number): void {
  nowMs = now;
}

/** Restore the pinned key and the production clock. */
export function resetRulesetPinForTests(): void {
  activeVerifyingKey = LOCAL_SP1_VERIFYING_KEY;
  pending = null;
  nowMs = () => Date.now();
}

function canonicalVkey(value: string): string | null {
  const body = value.startsWith("0x") || value.startsWith("0X") ? value.slice(2) : "";
  if (!/^[0-9a-fA-F]{64}$/.test(body)) return null;
  return `0x${body.toLowerCase()}`;
}

function applyDue(now: number): void {
  if (pending && now >= pending.activatesAt) {
    activeVerifyingKey = pending.verifyingKey;
    pending = null;
  }
}

/** Wasm digest plus the verifying key that is active at `now`. */
export function rulesetRecord(now: number = nowMs()): RulesetRecord {
  applyDue(now);
  return {
    wasmSha256: LOCAL_RULESET_WASM_SHA256,
    verifyingKey: activeVerifyingKey,
  };
}

/**
 * Schedule a verifying-key change. The active key stays put until
 * `RULESET_MIN_DELAY_MS` has elapsed. A value that is not a 32-byte hex key
 * does not schedule a change.
 */
export function setVerifyingKey(next: string, now: number = nowMs()): void {
  applyDue(now);
  const key = canonicalVkey(next);
  if (!key || key === activeVerifyingKey) return;
  pending = { verifyingKey: key, activatesAt: now + RULESET_MIN_DELAY_MS };
}

/**
 * True when the batch carries no proof, or the proof's verifying key is the
 * active pin. This is only the key check. A presented key is allowed to
 * accept a batch only after the proof result agrees with replay of the
 * pinned wasm.
 */
export function proofVerifyingKeyAccepted(
  presented: string | undefined,
  now: number = nowMs(),
): boolean {
  if (presented === undefined) return true;
  const key = canonicalVkey(presented);
  if (!key) return false;
  return key === rulesetRecord(now).verifyingKey;
}

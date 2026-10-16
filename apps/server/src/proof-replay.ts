/**
 * Replay the pinned engine wasm for one batch.
 *
 * The bytes are `contracts/lok-log/engine/pkg/lok_engine.wasm`. Their sha256
 * must be `LOCAL_RULESET_WASM_SHA256`. This module does not rebuild that
 * file. The replay result is the character-root tree `lok_character_root`
 * writes after opening the batch inputs as a log. A proof whose result is
 * not those 32 bytes disagrees, and the proof is ignored. A disagreement is
 * not stored. `storeAcceptedProof` records a result only when it matches
 * this replay.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { defaultWasmPath, lokCall, lokOut, type LokExports } from "./lok-engine";
import { LOCAL_RULESET_WASM_SHA256 } from "./lok-vault";

const accepted = new Map<string, Uint8Array>();

/** Character-root tree from the pinned wasm, or null when that replay cannot run. */
export function replayPinnedWasm(inputs: Uint8Array): Uint8Array | null {
  const exp = openPinnedWasm();
  if (!exp) return null;
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(inputs);
  } catch {
    return null;
  }
  const opened = lokCall(exp, text, exp.lok_open);
  if (opened.rc !== 0) return null;
  if (exp.lok_character_root() !== 0) return null;
  return hex32(lokOut(exp));
}

/**
 * True when `proofResult` is the pinned-wasm replay of `inputs`.
 * A missing result, or a replay that does not run, disagrees.
 */
export function proofResultMatchesReplay(inputs: Uint8Array, proofResult: Uint8Array | undefined): boolean {
  if (!proofResult) return false;
  const replay = replayPinnedWasm(inputs);
  if (!replay || proofResult.length !== replay.length) return false;
  return timingSafeEqual(proofResult, replay);
}

/** Drop recorded proofs. Tests use this so one case cannot see another. */
export function resetAcceptedProofsForTests(): void {
  accepted.clear();
}

/**
 * Record `proofResult` as accepted for `inputs`.
 * Returns false, and writes nothing, when the result disagrees with replay
 * of the pinned wasm.
 */
export function storeAcceptedProof(inputs: Uint8Array, proofResult: Uint8Array): boolean {
  if (!proofResultMatchesReplay(inputs, proofResult)) return false;
  accepted.set(proofKey(inputs, proofResult), new Uint8Array(proofResult));
  return true;
}

/** The stored result, or null when this proof was not accepted. */
export function acceptedProof(inputs: Uint8Array, proofResult: Uint8Array): Uint8Array | null {
  const found = accepted.get(proofKey(inputs, proofResult));
  return found ? new Uint8Array(found) : null;
}

function proofKey(inputs: Uint8Array, proofResult: Uint8Array): string {
  return createHash("sha256").update(LOCAL_RULESET_WASM_SHA256).update(inputs).update(proofResult).digest("hex");
}

function openPinnedWasm(): LokExports | null {
  let bytes: Buffer;
  try {
    bytes = readFileSync(defaultWasmPath());
  } catch {
    return null;
  }
  if (createHash("sha256").update(bytes).digest("hex") !== LOCAL_RULESET_WASM_SHA256) return null;
  try {
    const wasm = new Uint8Array(bytes.byteLength);
    wasm.set(bytes);
    const module = new WebAssembly.Module(wasm);
    const instance = new WebAssembly.Instance(module, {});
    return instance.exports as unknown as LokExports;
  } catch {
    return null;
  }
}

function hex32(hex: string): Uint8Array | null {
  if (!/^[0-9a-f]{64}$/.test(hex)) return null;
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

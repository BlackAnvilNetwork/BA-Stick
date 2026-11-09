/**
 * Shared movement intent for keyboard WASD and on-screen virtual sticks.
 * Consumed by WorldScene WasdController each frame.
 *
 * Stick mapping: screen-space +x right, +y up. Iso A/D is already screen-relative
 * — do not flip setVirtualStick. 3D strafe is negated at the call sites (StickWorld walk,
 * `dashDirection`), not here.
 *
 * Deadzone is hypot 0.28. Iso flags still use a 0.35 unit-axis cone after
 * normalize (8-way, ~20° cardinal). Opposing keyboard+stick bits cancel;
 * analog wins on an axis when the stick has a flag there.
 */

export type MoveKeys = { w: boolean; a: boolean; s: boolean; d: boolean };

const keyboard: MoveKeys = { w: false, a: false, s: false, d: false };
const stick: MoveKeys = { w: false, a: false, s: false, d: false };

/** Hypot deadzone for analog. One threshold — the 0.35 value below is angular, not a second mag band. */
export const DEADZONE = 0.28;
/** After normalize, |axis| must exceed this to set a WASD flag (iso 8-way cone). */
export const STICK_FLAG_CONE = 0.35;

let stickNx = 0;
let stickNy = 0;
let stickCaptured = false;
/** `performance.now()` when capture dropped — canvas must not treat that pointer as a ground click. */
let stickReleasedAt = 0;

export function setKeyboardMoveKey(key: keyof MoveKeys, down: boolean): void {
  keyboard[key] = down;
}

export function clearKeyboardMove(): void {
  keyboard.w = keyboard.a = keyboard.s = keyboard.d = false;
}

/** Keyboard bits only — leftover WASD for click-to-move, never the analog pad. */
export function getKeyboardMoveKeys(): MoveKeys {
  return { ...keyboard };
}

/** True while a Move-pad pointer is captured, even inside the deadzone. */
export function setVirtualStickCaptured(held: boolean): void {
  stickCaptured = held;
}

export function virtualStickHeld(): boolean {
  return stickCaptured || Math.hypot(stickNx, stickNy) >= DEADZONE;
}

/** Call when analog capture ends so a follow-up canvas pointerdown is not click-to-move. */
export function markVirtualStickReleased(): void {
  stickReleasedAt = performance.now();
}

/** True for a short window after analog capture ends (lostpointercapture → canvas pointerdown). */
export function virtualStickReleasedRecently(ms = 400): boolean {
  return stickReleasedAt > 0 && performance.now() - stickReleasedAt < ms;
}

/** Live stick axes, or null when the stick is in the deadzone. */
export function getStickAxes(): { nx: number; ny: number } | null {
  if (Math.hypot(stickNx, stickNy) < DEADZONE) return null;
  return { nx: stickNx, ny: stickNy };
}

/** Screen-space stick: +x right, +y up. Maps to isometric WASD flags. */
export function setVirtualStick(nx: number, ny: number): void {
  stickNx = nx;
  stickNy = ny;
  const mag = Math.hypot(nx, ny);
  if (mag < DEADZONE) {
    stick.w = stick.a = stick.s = stick.d = false;
    return;
  }
  const x = nx / mag;
  const y = ny / mag;
  // Prefer cardinals; allow diagonals when both axes are strong.
  stick.w = y > STICK_FLAG_CONE;
  stick.s = y < -STICK_FLAG_CONE;
  stick.d = x > STICK_FLAG_CONE;
  stick.a = x < -STICK_FLAG_CONE;
}

export function clearVirtualStick(): void {
  stickNx = 0;
  stickNy = 0;
  stickCaptured = false;
  stick.w = stick.a = stick.s = stick.d = false;
  stickReleasedAt = 0;
}

function mergeAxis(
  keyPos: boolean,
  keyNeg: boolean,
  stickPos: boolean,
  stickNeg: boolean,
): { pos: boolean; neg: boolean } {
  if (stickPos !== stickNeg) return { pos: stickPos, neg: stickNeg };
  if (keyPos && keyNeg) return { pos: false, neg: false };
  return { pos: keyPos, neg: keyNeg };
}

export function getMoveKeys(): MoveKeys {
  const ns = mergeAxis(keyboard.w, keyboard.s, stick.w, stick.s);
  const ew = mergeAxis(keyboard.d, keyboard.a, stick.d, stick.a);
  return { w: ns.pos, s: ns.neg, d: ew.pos, a: ew.neg };
}

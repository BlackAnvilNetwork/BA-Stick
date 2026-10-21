/**
 * Shared movement intent for keyboard WASD and on-screen virtual sticks.
 * Consumed by WorldScene WasdController each frame.
 */

export type MoveKeys = { w: boolean; a: boolean; s: boolean; d: boolean };

const keyboard: MoveKeys = { w: false, a: false, s: false, d: false };
const stick: MoveKeys = { w: false, a: false, s: false, d: false };

const DEADZONE = 0.28;

export function setKeyboardMoveKey(key: keyof MoveKeys, down: boolean): void {
  keyboard[key] = down;
}

export function clearKeyboardMove(): void {
  keyboard.w = keyboard.a = keyboard.s = keyboard.d = false;
}

/** Screen-space stick: +x right, +y up. Maps to isometric WASD flags. */
export function setVirtualStick(nx: number, ny: number): void {
  const mag = Math.hypot(nx, ny);
  if (mag < DEADZONE) {
    stick.w = stick.a = stick.s = stick.d = false;
    return;
  }
  const x = nx / mag;
  const y = ny / mag;
  // Prefer cardinals; allow diagonals when both axes are strong.
  stick.w = y > 0.35;
  stick.s = y < -0.35;
  stick.d = x > 0.35;
  stick.a = x < -0.35;
}

export function clearVirtualStick(): void {
  stick.w = stick.a = stick.s = stick.d = false;
}

export function getMoveKeys(): MoveKeys {
  return {
    w: keyboard.w || stick.w,
    a: keyboard.a || stick.a,
    s: keyboard.s || stick.s,
    d: keyboard.d || stick.d,
  };
}

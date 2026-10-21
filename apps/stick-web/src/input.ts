import { paleHollowClampMove } from "@bellgrave/config";
import { getMoveKeys } from "@bellgrave/ui/moveInput";

/** WASD step length per send, in world units (matches the legacy client). */
export const WASD_STEP = 4.5;

/**
 * Screen-relative WASD → world direction. `pick` maps a framebuffer pixel to
 * ground (x, z), so this follows whatever projection the renderer uses.
 */
export function wasdTarget(
  keys: { w: boolean; a: boolean; s: boolean; d: boolean },
  me: { x: number; z: number },
  pick: (sx: number, sy: number) => [number, number],
  center: [number, number],
): { x: number; z: number } | null {
  const sx = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
  const sy = (keys.s ? 1 : 0) - (keys.w ? 1 : 0);
  if (!sx && !sy) return null;
  const [ax, az] = pick(center[0], center[1]);
  const [bx, bz] = pick(center[0] + sx * 64, center[1] + sy * 64);
  const dx = bx - ax;
  const dz = bz - az;
  const len = Math.hypot(dx, dz);
  if (len < 1e-6) return null;
  const c = paleHollowClampMove(me.x, me.z, me.x + (dx / len) * WASD_STEP, me.z + (dz / len) * WASD_STEP);
  if (Math.hypot(c.x - me.x, c.z - me.z) < 1e-4) return null;
  return c;
}

export { getMoveKeys };

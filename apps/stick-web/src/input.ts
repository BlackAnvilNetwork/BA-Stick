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
  clamp: (fromX: number, fromZ: number, toX: number, toZ: number) => { x: number; z: number } = paleHollowClampMove,
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
  const c = clamp(me.x, me.z, me.x + (dx / len) * WASD_STEP, me.z + (dz / len) * WASD_STEP);
  if (Math.hypot(c.x - me.x, c.z - me.z) < 1e-4) return null;
  return c;
}

type MoveKeys = { w: boolean; a: boolean; s: boolean; d: boolean };
type Clamp = (fromX: number, fromZ: number, toX: number, toZ: number) => { x: number; z: number };

/** Third/first-person turn rate for A/D, radians per second. */
export const TURN_RATE = 2.2;

/**
 * Third/first-person heading after `dt` seconds: A turns left (+yaw), D turns
 * right. Facing for a yaw is (sin yaw, cos yaw), matching the server.
 */
export function headingStep(keys: MoveKeys, heading: number, dt: number): number {
  const turn = (keys.a ? 1 : 0) - (keys.d ? 1 : 0);
  if (!turn) return heading;
  const h = heading + turn * TURN_RATE * dt;
  return Math.atan2(Math.sin(h), Math.cos(h));
}

/** Third/first-person W/S target: `WASD_STEP` along (S: against) the heading. */
export function headingTarget(keys: MoveKeys, me: { x: number; z: number }, heading: number, clamp: Clamp = paleHollowClampMove): { x: number; z: number } | null {
  const dir = (keys.w ? 1 : 0) - (keys.s ? 1 : 0);
  if (!dir) return null;
  const c = clamp(me.x, me.z, me.x + Math.sin(heading) * dir * WASD_STEP, me.z + Math.cos(heading) * dir * WASD_STEP);
  if (Math.hypot(c.x - me.x, c.z - me.z) < 1e-4) return null;
  return c;
}

/** Rate (1/s) at which a click turns the 3D heading toward its target. */
export const HEADING_EASE = 12;

/**
 * Ease `heading` toward `goal` along the short arc, so a click in first person
 * turns the view over a few frames instead of snapping it. Returns the new
 * heading and whether the goal was reached.
 */
export function headingEase(heading: number, goal: number, dt: number): { heading: number; done: boolean } {
  const diff = Math.atan2(Math.sin(goal - heading), Math.cos(goal - heading));
  if (Math.abs(diff) < 0.01) return { heading: goal, done: true };
  const h = heading + diff * (1 - Math.exp(-HEADING_EASE * dt));
  return { heading: Math.atan2(Math.sin(h), Math.cos(h)), done: false };
}

/**
 * Third/first-person heading goal while fighting. The server already turns an
 * engaged / auto-attacking player toward its target (iso shows that facing);
 * the 3D heading follows the same server facing, under the same trigger
 * (`targetId`, set by Enter/engage or auto-attack, not by tab selection).
 * Any move key hands control back to the player.
 */
export function engageHeadingGoal(me: { facing: number; targetId?: string | null }, keys: MoveKeys): number | null {
  if (!me.targetId || keys.w || keys.a || keys.s || keys.d) return null;
  return Number.isFinite(me.facing) ? me.facing : null;
}

/** Yaw that faces from `me` toward a point (server convention). */
export function headingToward(me: { x: number; z: number }, x: number, z: number): number | null {
  const dx = x - me.x;
  const dz = z - me.z;
  return Math.hypot(dx, dz) < 0.25 ? null : Math.atan2(dx, dz);
}

/**
 * WASD move intent for the current view. Iso is exactly `wasdTarget`
 * (screen-relative). Third/first person steers a client heading.
 */
export function wasdIntent(args: {
  view: "iso" | "tp" | "fp";
  keys: MoveKeys;
  me: { x: number; z: number };
  heading: number;
  pick: (sx: number, sy: number) => [number, number];
  center: [number, number];
  clamp?: Clamp;
}): { x: number; z: number } | null {
  if (args.view === "iso") return wasdTarget(args.keys, args.me, args.pick, args.center, args.clamp);
  return headingTarget(args.keys, args.me, args.heading, args.clamp);
}

/**
 * When to re-send a held W/S target in 3D. The server re-routes on every
 * move, so sending every 50 ms stutters; resend only when the intent changed,
 * the heading drifted, the target is nearly reached, or as a keep-alive.
 */
export function shouldResend(
  prev: { keys: string; heading: number; at: number; x: number; z: number } | null,
  now: { keys: string; heading: number; at: number },
  me: { x: number; z: number },
): boolean {
  if (!prev) return true;
  if (prev.keys !== now.keys) return true;
  const dh = Math.abs(Math.atan2(Math.sin(now.heading - prev.heading), Math.cos(now.heading - prev.heading)));
  if (dh > (3 * Math.PI) / 180) return true;
  if (Math.hypot(prev.x - me.x, prev.z - me.z) < 2.5) return true;
  return now.at - prev.at >= 250;
}

/** Physical WASD and the arrow keys. `code` so layout and arrows both walk. */
export function moveKeyFromCode(code: string): "w" | "a" | "s" | "d" | null {
  switch (code) {
    case "KeyW":
    case "ArrowUp":
      return "w";
    case "KeyA":
    case "ArrowLeft":
      return "a";
    case "KeyS":
    case "ArrowDown":
      return "s";
    case "KeyD":
    case "ArrowRight":
      return "d";
    default:
      return null;
  }
}

export { getMoveKeys };

/** Metres a stop lands ahead of the (one-snapshot-old) server position. */
export const STOP_LEAD = 0.3;

/**
 * Where to send the unit when move keys are released: the server position plus a
 * short lead toward the last WASD target, so the stop neither finishes the 4.5 m
 * step nor tugs the unit back to where the last snapshot saw it.
 */
export function stopTarget(
  me: { x: number; z: number },
  last: { x: number; z: number },
  lead = STOP_LEAD,
): { x: number; z: number } {
  const dx = last.x - me.x;
  const dz = last.z - me.z;
  const d = Math.hypot(dx, dz);
  if (d < 1e-6) return { x: me.x, z: me.z };
  const k = Math.min(lead, d) / d;
  return { x: me.x + dx * k, z: me.z + dz * k };
}

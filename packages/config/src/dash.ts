/**
 * Dash: a short burst every class has, ported from Stick Engine's `dash`
 * action (lunge pose, afterimage trail) and tuned for BA-Stick's 6 m/s run
 * and MMO pacing: DASH_DISTANCE metres over DASH_MS (about 17 m/s average,
 * eased out).
 *
 * The server owns it. The client sends only a direction. The server checks
 * the cooldown, walks the segment in small steps with the zone's own move
 * clamp so the dash stops at walls and zone bounds, and never goes past
 * the planned distance (DASH_DISTANCE, or an ability range) however the
 * message is forged.
 */

export const DASH_DISTANCE = 4;
export const DASH_MS = 240;
export const DASH_COOLDOWN_MS = 3000;

/** Flight time for a dash that covers `travelled` meters. Matches `planDash`. */
export function dashDurationMs(travelled: number): number {
  const d = Number.isFinite(travelled) && travelled > 0 ? travelled : DASH_DISTANCE;
  return DASH_MS * (d / DASH_DISTANCE);
}
/** Sub-step for the wall walk: matches MOVE_SAMPLE so a thin wall cannot be skipped. */
export const DASH_SUBSTEP = 0.15;
/** A dash that cannot get this far (flush against a wall) is refused. */
export const DASH_MIN = 0.4;

export type ClampMove = (fromX: number, fromZ: number, toX: number, toZ: number) => { x: number; z: number };

export type DashRun = { fx: number; fz: number; tx: number; tz: number; start: number; end: number };

export type DashPlan =
  | { ok: true; run: DashRun; facing: number }
  | { ok: false; reason: "cooldown" | "direction" | "blocked"; readyIn?: number };

/** Validate a dash request and plan its path. Pure: no player state is touched. */
export function planDash(
  from: { x: number; z: number },
  dir: { dx: number; dz: number },
  clamp: ClampMove,
  now: number,
  lastDashAt: number | undefined,
  distance = DASH_DISTANCE,
): DashPlan {
  if (lastDashAt != null && now - lastDashAt < DASH_COOLDOWN_MS) {
    return { ok: false, reason: "cooldown", readyIn: DASH_COOLDOWN_MS - (now - lastDashAt) };
  }
  const len = Math.hypot(dir.dx, dir.dz);
  if (!Number.isFinite(len) || len < 1e-3) return { ok: false, reason: "direction" };
  const cap = Number.isFinite(distance) && distance > 0 ? distance : DASH_DISTANCE;
  const ux = dir.dx / len;
  const uz = dir.dz / len;
  let x = from.x;
  let z = from.z;
  const steps = Math.ceil(cap / DASH_SUBSTEP);
  for (let i = 0; i < steps; i++) {
    const s = Math.max(0, Math.min(DASH_SUBSTEP, cap - i * DASH_SUBSTEP));
    const wx = x + ux * s;
    const wz = z + uz * s;
    const c = clamp(x, z, wx, wz);
    // A blocked or sliding sub-step ends the dash where it is: no wall clips, no corner slides.
    if (!Number.isFinite(c.x) || !Number.isFinite(c.z) || Math.hypot(c.x - wx, c.z - wz) > 0.02) break;
    x = c.x;
    z = c.z;
  }
  const d = Math.hypot(x - from.x, z - from.z);
  if (d < DASH_MIN) return { ok: false, reason: "blocked" };
  return {
    ok: true,
    run: { fx: from.x, fz: from.z, tx: x, tz: z, start: now, end: now + dashDurationMs(d) },
    facing: Math.atan2(ux, uz),
  };
}

/** Ease-out position along a dash: fast launch, soft landing (Stick Engine's lunge reads the same). */
export function dashPos(run: DashRun, now: number): { x: number; z: number; done: boolean } {
  const span = Math.max(1, run.end - run.start);
  const t = Math.min(1, Math.max(0, (now - run.start) / span));
  const k = 1 - (1 - t) * (1 - t);
  return { x: run.fx + (run.tx - run.fx) * k, z: run.fz + (run.tz - run.fz) * k, done: t >= 1 };
}

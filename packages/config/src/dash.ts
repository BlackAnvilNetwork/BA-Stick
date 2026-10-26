/**
 * Dash: a short burst every class has, ported from Stick Engine's `dash`
 * action (13 m/s for 0.22 s, lunge pose, afterimage trail) and tuned for
 * BA-Stick's 6 m/s run and MMO pacing.
 *
 * The server owns it. The client sends only a direction. The server checks
 * the cooldown, walks the segment in small steps with the zone's own move
 * clamp so the dash stops at walls and zone bounds, and never goes past
 * DASH_DISTANCE however the message is forged.
 */

export const DASH_DISTANCE = 4;
export const DASH_MS = 240;
export const DASH_COOLDOWN_MS = 3000;
/** Sub-step for the wall walk: well under any wall thickness on the grid. */
export const DASH_SUBSTEP = 0.2;
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
): DashPlan {
  if (lastDashAt != null && now - lastDashAt < DASH_COOLDOWN_MS) {
    return { ok: false, reason: "cooldown", readyIn: DASH_COOLDOWN_MS - (now - lastDashAt) };
  }
  const len = Math.hypot(dir.dx, dir.dz);
  if (!Number.isFinite(len) || len < 1e-3) return { ok: false, reason: "direction" };
  const ux = dir.dx / len;
  const uz = dir.dz / len;
  let x = from.x;
  let z = from.z;
  const steps = Math.ceil(DASH_DISTANCE / DASH_SUBSTEP);
  for (let i = 0; i < steps; i++) {
    const s = Math.min(DASH_SUBSTEP, DASH_DISTANCE - i * DASH_SUBSTEP);
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
    run: { fx: from.x, fz: from.z, tx: x, tz: z, start: now, end: now + DASH_MS * (d / DASH_DISTANCE) },
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

/**
 * Shared walk clamp: sample a segment, stop at walls, then slide on the axes.
 *
 * Every per-step mover (client prediction, the server walk tick, dash, and
 * mob steer) goes through a zone clampMove built on this. Only the server's
 * click-to-move `assignRoute` plans a path (A*), and only when the straight
 * slide cannot reach the goal. Older copies of this clamp teleported from any
 * unwalkable start to a walkable dest (clipping through walls) and stopped
 * dead on a diagonal into a corridor wall.
 */

/** Under DASH_SUBSTEP and typical wall thickness (river solid ~0.59 m). */
export const MOVE_SAMPLE = 0.15;

/** Radial search when the start is already inside a wall or water. */
export const UNSTUCK_RADIUS = 6;

export type ClampPoint = (x: number, z: number) => { x: number; z: number };
export type WalkableAt = (x: number, z: number) => boolean;

function crossesOpenWater(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  openWater: WalkableAt,
): boolean {
  const dist = Math.hypot(bx - ax, bz - az);
  if (dist < 1e-4) return false;
  const steps = Math.max(2, Math.ceil(dist / MOVE_SAMPLE));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (openWater(ax + (bx - ax) * t, az + (bz - az) * t)) return true;
  }
  return false;
}

/** Closest walkable point within `maxR`, or null if the start is boxed in. */
export function nearestWalkable(
  clamp: ClampPoint,
  walkable: WalkableAt,
  x: number,
  z: number,
  maxR = UNSTUCK_RADIUS,
  openWater?: WalkableAt,
): { x: number; z: number } | null {
  const c = clamp(x, z);
  if (walkable(c.x, c.z)) return c;
  for (let r = MOVE_SAMPLE; r <= maxR + 1e-6; r += MOVE_SAMPLE) {
    const n = Math.max(8, Math.round(r * 12));
    let best: { x: number; z: number } | null = null;
    let bestD = Infinity;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const q = clamp(c.x + Math.sin(a) * r, c.z + Math.cos(a) * r);
      if (!walkable(q.x, q.z)) continue;
      if (openWater && crossesOpenWater(c.x, c.z, q.x, q.z, openWater)) continue;
      const d = Math.hypot(q.x - c.x, q.z - c.z);
      if (d < bestD) {
        bestD = d;
        best = q;
      }
    }
    if (best) return best;
  }
  return null;
}

/** Straight walk, no unstuck, no axis slide. Path lineClear uses this. */
export function straightMove(
  clamp: ClampPoint,
  walkable: WalkableAt,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
): { x: number; z: number } {
  if (!walkable(fromX, fromZ)) return { x: fromX, z: fromZ };
  return walkSegment(clamp, walkable, fromX, fromZ, toX, toZ);
}

function walkSegment(
  clamp: ClampPoint,
  walkable: WalkableAt,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
): { x: number; z: number } {
  const end = clamp(toX, toZ);
  const dist = Math.hypot(end.x - fromX, end.z - fromZ);
  if (dist < 1e-4) return { x: fromX, z: fromZ };
  const steps = Math.max(1, Math.ceil(dist / MOVE_SAMPLE));
  let last = { x: fromX, z: fromZ };
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const c = clamp(fromX + (end.x - fromX) * t, fromZ + (end.z - fromZ) * t);
    if (!walkable(c.x, c.z)) return last;
    last = c;
  }
  return last;
}

/**
 * Clamp a desired step. If `from` is unwalkable, snap to the nearest walkable
 * cell (never the far side of a wall). Then walk the segment and, if a wall
 * stops the diagonal, slide on X and Z so a corridor edge does not pin you.
 */
export function slideMove(
  clamp: ClampPoint,
  walkable: WalkableAt,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  openWater?: WalkableAt,
): { x: number; z: number } {
  let fx = fromX;
  let fz = fromZ;
  if (!walkable(fx, fz)) {
    const snap = nearestWalkable(clamp, walkable, fx, fz, UNSTUCK_RADIUS, openWater);
    if (!snap) return { x: fx, z: fz };
    fx = snap.x;
    fz = snap.z;
  }
  const end = clamp(toX, toZ);
  const along = walkSegment(clamp, walkable, fx, fz, end.x, end.z);
  if (Math.hypot(along.x - end.x, along.z - end.z) < 0.02) return along;

  const slidX = walkSegment(clamp, walkable, along.x, along.z, end.x, along.z);
  const slidXZ = walkSegment(clamp, walkable, slidX.x, slidX.z, slidX.x, end.z);
  const slidZ = walkSegment(clamp, walkable, along.x, along.z, along.x, end.z);
  const slidZX = walkSegment(clamp, walkable, slidZ.x, slidZ.z, end.x, slidZ.z);

  const dAlong = Math.hypot(along.x - end.x, along.z - end.z);
  const dXZ = Math.hypot(slidXZ.x - end.x, slidXZ.z - end.z);
  const dZX = Math.hypot(slidZX.x - end.x, slidZX.z - end.z);
  if (dXZ <= dZX && dXZ < dAlong - 1e-6) return slidXZ;
  if (dZX < dAlong - 1e-6) return slidZX;
  return along;
}

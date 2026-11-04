/** Distance from (px, pz) to segment a→b in the XZ plane. */
export function pointToSegmentDist(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

export type TrailPolyline = {
  surface?: string;
  points: readonly { x: number; z: number }[];
};

/**
 * True when (x, z) lies in the same corridor baked into BAZ1 trail flags
 * (distance to any segment ≤ trailWidth / 2).
 */
export function nearTrailCorridor(
  x: number,
  z: number,
  trails: readonly TrailPolyline[],
  trailWidth: number,
  widthForTrail?: (t: TrailPolyline) => number,
): boolean {
  for (const t of trails) {
    const w = widthForTrail ? widthForTrail(t) : trailWidth;
    const half = w / 2;
    const pts = t.points;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!;
      const b = pts[i]!;
      if (pointToSegmentDist(x, z, a.x, a.z, b.x, b.z) <= half) return true;
    }
  }
  return false;
}

/** Box-filter window along the spine (m). Long enough to eat a terrain bump, short enough to keep a real grade. */
const GRADE_WINDOW_M = 8;
/** Sample step along the spine (m). */
const GRADE_STEP_M = 1;

type GradeProfile = { sampleS: number[]; sampleY: number[] };

const gradeCache = new WeakMap<TrailPolyline, { groundY: (x: number, z: number) => number; profile: GradeProfile }>();

function polylineS(pts: readonly { x: number; z: number }[]): number[] {
  const s = [0];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!, b = pts[i]!;
    s.push(s[i - 1]! + Math.hypot(b.x - a.x, b.z - a.z));
  }
  return s;
}

function pointAtS(pts: readonly { x: number; z: number }[], lens: number[], s: number): { x: number; z: number } {
  if (s <= 0) return pts[0]!;
  const last = lens[lens.length - 1]!;
  if (s >= last) return pts[pts.length - 1]!;
  for (let i = 1; i < pts.length; i++) {
    if (s <= lens[i]!) {
      const span = lens[i]! - lens[i - 1]! || 1;
      const t = (s - lens[i - 1]!) / span;
      const a = pts[i - 1]!, b = pts[i]!;
      return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
    }
  }
  return pts[pts.length - 1]!;
}

function buildGrade(t: TrailPolyline, groundY: (x: number, z: number) => number): GradeProfile {
  const pts = t.points;
  const lens = polylineS(pts);
  const total = lens[lens.length - 1] ?? 0;
  const n = Math.max(1, Math.ceil(total / GRADE_STEP_M));
  const sampleS: number[] = [];
  const raw: number[] = [];
  for (let i = 0; i <= n; i++) {
    const si = (i / n) * total;
    const p = pointAtS(pts, lens, si);
    sampleS.push(si);
    raw.push(groundY(p.x, p.z));
  }
  const half = GRADE_WINDOW_M * 0.5;
  const sampleY = raw.map((_, i) => {
    const si = sampleS[i]!;
    let sum = 0;
    let cnt = 0;
    for (let j = 0; j < raw.length; j++) {
      const y = raw[j]!;
      if (!Number.isFinite(y)) continue;
      if (Math.abs(sampleS[j]! - si) <= half) {
        sum += y;
        cnt++;
      }
    }
    if (cnt > 0) return sum / cnt;
    let best = Number.NaN;
    let bestD = Infinity;
    for (let j = 0; j < raw.length; j++) {
      const y = raw[j]!;
      if (!Number.isFinite(y)) continue;
      const d = Math.abs(sampleS[j]! - si);
      if (d < bestD) {
        bestD = d;
        best = y;
      }
    }
    return Number.isFinite(best) ? best : 0;
  });
  return { sampleS, sampleY };
}

function profileOf(t: TrailPolyline, groundY: (x: number, z: number) => number): GradeProfile {
  const hit = gradeCache.get(t);
  if (hit && hit.groundY === groundY) return hit.profile;
  const profile = buildGrade(t, groundY);
  gradeCache.set(t, { groundY, profile });
  return profile;
}

function lerpGrade(p: GradeProfile, s: number): number {
  const ss = p.sampleS;
  const yy = p.sampleY;
  if (s <= ss[0]!) return yy[0]!;
  const last = ss[ss.length - 1]!;
  if (s >= last) return yy[yy.length - 1]!;
  for (let i = 1; i < ss.length; i++) {
    if (s <= ss[i]!) {
      const span = ss[i]! - ss[i - 1]! || 1;
      const t = (s - ss[i - 1]!) / span;
      return yy[i - 1]! + (yy[i]! - yy[i - 1]!) * t;
    }
  }
  return yy[yy.length - 1]!;
}

/**
 * Man-made road height: project onto the nearest spine, then a box-filtered
 * lerp of `groundY` along that polyline. The same Y is used across the
 * corridor (no crown, no side-slope). Off the road → null.
 *
 * `groundY` may return NaN to skip a sample (water / a bridge span) so the
 * filter does not pull the grade into a river bed.
 */
export function gradedCorridorY(
  x: number,
  z: number,
  trails: readonly TrailPolyline[],
  halfWidth: number,
  groundY: (x: number, z: number) => number,
): number | null {
  let best: { trail: TrailPolyline; s: number; dist: number } | null = null;
  for (const trail of trails) {
    const pts = trail.points;
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!, b = pts[i]!;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const l2 = dx * dx + dz * dz || 1;
      const len = Math.sqrt(l2);
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2));
      const dist = Math.hypot(x - (a.x + t * dx), z - (a.z + t * dz));
      if (!best || dist < best.dist) {
        best = { trail, s: acc + t * len, dist };
      }
      acc += len;
    }
  }
  if (!best || best.dist > halfWidth) return null;
  return lerpGrade(profileOf(best.trail, groundY), best.s);
}

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

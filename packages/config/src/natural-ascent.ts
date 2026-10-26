/**
 * Natural ascents into blocked peak cores: a short mouth cut into the rim, a winding coil that climbs inside the
 * core and a short level walk-in to a summit vista. Grow-only: callers only open cells that were core-blocked.
 * Heights follow the path's arclength (with uneven treads), blended back into the rim terrain at the mouth.
 */
export type AscentPeak = { x: number; z: number; r: number };
export type AscentDef = { id: string; name: string; kind: "stair" | "ledge" | "cave"; peak: number; a0: number; turns: number; half: number; rout: number; rin: number };
export type Ascent = AscentDef & { pts: { x: number; z: number; y: number }[] };

function smooth(t: number): number {
  const u = Math.max(0, Math.min(1, t));
  return u * u * (3 - 2 * u);
}

export function makeAscents(defs: readonly AscentDef[], peaks: readonly AscentPeak[], coreFrac: number, terrainY: (x: number, z: number) => number) {
  let cache: Ascent[] | null = null;
  const list = (): Ascent[] => {
    if (cache) return cache;
    cache = defs.map((d) => {
      const m = peaks[d.peak]!;
      const rc = m.r * coreFrac;
      const raw: { x: number; z: number }[] = [];
      const N = 180;
      for (let k = 0; k <= N; k++) {
        const s = k / N, e = 0.1;
        const u = (s - e) / (1 - e);
        const coil = u < 0.9 ? rc * (d.rout - (d.rout - d.rin) * (u / 0.9)) : rc * (d.rin - d.rin * ((u - 0.9) / 0.1));
        const rho = s < e ? rc * (1.15 - (1.15 - d.rout) * (s / e)) : coil + 0.2 * Math.sin(s * 23 + d.peak) * (1 - s);
        const a = d.a0 + d.turns * 2 * Math.PI * Math.min(1, Math.max(0, (s - 0.1) / 0.81)) + 0.1 * Math.sin(s * 17 + 2 * d.peak) + 0.05 * Math.sin(s * 41);
        raw.push({ x: m.x + rho * Math.cos(a), z: m.z + rho * Math.sin(a) });
      }
      let L = 0;
      const acc = [0];
      for (let k = 1; k < raw.length; k++) acc.push((L += Math.hypot(raw[k]!.x - raw[k - 1]!.x, raw[k]!.z - raw[k - 1]!.z)));
      const y0 = terrainY(raw[0]!.x, raw[0]!.z), y1 = terrainY(m.x, m.z);
      const ease = (v: number) => v + 0.018 * Math.sin(v * Math.PI * 9); // uneven treads, still monotonic
      return { ...d, pts: raw.map((p, k) => ({ ...p, y: y0 + (y1 - y0) * ease(Math.min(1, acc[k]! / (L - 2.2))) })) };
    });
    return cache;
  };
  /** Ascent floor height at (x, z), or null when off every ascent. */
  const at = (x: number, z: number): number | null => {
    for (let i = 0; i < defs.length; i++) {
      const d = defs[i]!, m = peaks[d.peak]!, rc = m.r * coreFrac;
      const dc = Math.hypot(x - m.x, z - m.z);
      if (dc > rc + 2) continue;
      const pts = list()[i]!.pts;
      if (dc < 0.45) return pts[pts.length - 1]!.y;
      let best = Infinity, by = 0, bk = 0;
      for (let k = 1; k < pts.length; k++) {
        const a = pts[k - 1]!, b = pts[k]!;
        const vx = b.x - a.x, vz = b.z - a.z;
        const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (z - a.z) * vz) / (vx * vx + vz * vz)));
        const dd = Math.hypot(x - a.x - vx * t, z - a.z - vz * t);
        if (dd < best) { best = dd; by = a.y + (b.y - a.y) * t; bk = k; }
      }
      if (best >= d.half * (1 + 0.18 * Math.sin(x * 0.9 + z * 1.3))) continue;
      const mouth = 1 - smooth((bk / pts.length - 0.04) / 0.08);
      const k = smooth((dc - rc + 1.4) / 1.4) * mouth;
      return by + (terrainY(x, z) - by) * k;
    }
    return null;
  };
  return { list, at };
}

/** Deterministic PRNG + gradient noise. Seeded per region; never Math.random. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(...parts: (string | number)[]): number {
  let h = 2166136261 >>> 0;
  for (const p of parts) {
    const s = String(p);
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
    h = Math.imul(h ^ 0x9e37, 16777619) >>> 0;
  }
  return h;
}

/** 2D gradient (Perlin-style) noise, -1..1, permutation from seed. */
export class Noise2 {
  private p: Uint8Array;
  constructor(seed: number) {
    const r = mulberry32(seed);
    const a = Array.from({ length: 256 }, (_, i) => i);
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
    this.p = new Uint8Array(512);
    for (let i = 0; i < 512; i++) this.p[i] = a[i & 255]!;
  }
  private g(h: number, x: number, y: number): number {
    switch (h & 7) {
      case 0: return x + y; case 1: return x - y; case 2: return -x + y; case 3: return -x - y;
      case 4: return x; case 5: return -x; case 6: return y; default: return -y;
    }
  }
  n(x: number, y: number): number {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const X = xi & 255, Y = yi & 255;
    const f = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
    const u = f(xf), v = f(yf);
    const p = this.p;
    const aa = p[p[X]! + Y]!, ab = p[p[X]! + Y + 1]!, ba = p[p[X + 1]! + Y]!, bb = p[p[X + 1]! + Y + 1]!;
    const l1 = this.g(aa, xf, yf) + u * (this.g(ba, xf - 1, yf) - this.g(aa, xf, yf));
    const l2 = this.g(ab, xf, yf - 1) + u * (this.g(bb, xf - 1, yf - 1) - this.g(ab, xf, yf - 1));
    return (l1 + v * (l2 - l1)) * 0.7;
  }
  fbm(x: number, y: number, oct = 5, lac = 2.03, gain = 0.5): number {
    let s = 0, a = 1, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) { s += a * this.n(x * f + i * 17.3, y * f - i * 9.1); norm += a; a *= gain; f *= lac; }
    return s / norm;
  }
  /** Ridged multifractal 0..1 — sharp crests for range spines. */
  ridged(x: number, y: number, oct = 5): number {
    let s = 0, a = 0.5, f = 1, w = 1, norm = 0;
    for (let i = 0; i < oct; i++) {
      let v = 1 - Math.abs(this.n(x * f + i * 31.7, y * f + i * 7.7));
      v *= v * w; w = Math.min(1, v * 2);
      s += v * a; norm += a; a *= 0.5; f *= 2.1;
    }
    return s / norm;
  }
}

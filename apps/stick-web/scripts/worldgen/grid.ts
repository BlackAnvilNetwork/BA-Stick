/** Grid algorithms: priority-flood fill, D8 routing, accumulation, distance transforms, A*. */
export class MinHeap {
  k: number[] = []; v: number[] = [];
  get size() { return this.k.length; }
  push(key: number, val: number) {
    const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val);
    while (i > 0) { const p = (i - 1) >> 1; if (k[p]! <= key) break; k[i] = k[p]!; v[i] = v[p]!; i = p; }
    k[i] = key; v[i] = val;
  }
  pop(): [number, number] {
    const k = this.k, v = this.v; const rk = k[0]!, rv = v[0]!;
    const lk = k.pop()!, lv = v.pop()!;
    if (k.length) {
      let i = 0; const n = k.length;
      for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && k[c + 1]! < k[c]!) c++; if (k[c]! >= lk) break; k[i] = k[c]!; v[i] = v[c]!; i = c; }
      k[i] = lk; v[i] = lv;
    }
    return [rk, rv];
  }
}
export const D8: [number, number, number][] = [[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,Math.SQRT2],[1,-1,Math.SQRT2],[-1,1,Math.SQRT2],[-1,-1,Math.SQRT2]];

/** Priority-flood (Barnes 2014) with epsilon. Seeds drain; `fixed` cells are never raised. */
export function priorityFill(h: Float32Array, W: number, H: number, seed: Uint8Array, fixed: Uint8Array | null, eps = 1e-4): number {
  const done = new Uint8Array(W * H); const q = new MinHeap(); let raised = 0;
  for (let k = 0; k < W * H; k++) {
    const i = k % W, j = (k / W) | 0;
    if (seed[k] || i === 0 || j === 0 || i === W - 1 || j === H - 1) { done[k] = 1; q.push(h[k]!, k); }
  }
  while (q.size) {
    const [, k] = q.pop(); const i = k % W, j = (k / W) | 0;
    for (const [di, dj] of D8) {
      const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
      const n = nj * W + ni; if (done[n]) continue; done[n] = 1;
      const floor = h[k]! + eps;
      if (h[n]! < floor && !(fixed && fixed[n])) { h[n] = floor; raised++; }
      q.push(h[n]!, n);
    }
  }
  return raised;
}

/** Steepest-descent receiver per cell (-1 = sink / seed / edge). */
export function d8Receivers(h: Float32Array, W: number, H: number, sink: Uint8Array | null): Int32Array {
  const r = new Int32Array(W * H).fill(-1);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i; if (sink && sink[k]) continue;
    let best = 0, bk = -1;
    for (const [di, dj, dl] of D8) {
      const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
      const s = (h[k]! - h[nj * W + ni]!) / dl; if (s > best) { best = s; bk = nj * W + ni; }
    }
    r[k] = bk;
  }
  return r;
}

export function accumulate(h: Float32Array, rec: Int32Array, weight?: Float32Array): Float32Array {
  const n = h.length; const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => h[b]! - h[a]!);
  const a = new Float32Array(n); for (let k = 0; k < n; k++) a[k] = weight ? weight[k]! : 1;
  for (const k of order) { const r = rec[k]!; if (r >= 0) a[r] += a[k]!; }
  return a;
}

/** Two-pass chamfer distance (cells) to cells where mask=1, plus index of nearest source. */
export function distanceTo(mask: Uint8Array, W: number, H: number): { d: Float32Array; src: Int32Array } {
  const d = new Float32Array(W * H).fill(1e9); const src = new Int32Array(W * H).fill(-1);
  for (let k = 0; k < W * H; k++) if (mask[k]) { d[k] = 0; src[k] = k; }
  const pass = (fw: boolean) => {
    const nb = fw ? [[-1,0,1],[0,-1,1],[-1,-1,1.4142],[1,-1,1.4142]] : [[1,0,1],[0,1,1],[1,1,1.4142],[-1,1,1.4142]];
    for (let jj = 0; jj < H; jj++) { const j = fw ? jj : H - 1 - jj;
      for (let ii = 0; ii < W; ii++) { const i = fw ? ii : W - 1 - ii; const k = j * W + i;
        for (const [di, dj, c] of nb) { const ni = i + di!, nj = j + dj!; if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
          const n = nj * W + ni; if (d[n]! + c! < d[k]!) { d[k] = d[n]! + c!; src[k] = src[n]!; } } } }
  };
  pass(true); pass(false); pass(true); pass(false);
  return { d, src };
}

/** A* on the grid with a per-step cost; Infinity = impassable. Returns cell path or null. */
export function astar(W: number, H: number, start: number, goal: number, cost: (from: number, to: number, dl: number) => number, hScale = 1): number[] | null {
  const g = new Float32Array(W * H).fill(Infinity); const came = new Int32Array(W * H).fill(-1); const closed = new Uint8Array(W * H);
  const q = new MinHeap(); const gi = goal % W, gj = (goal / W) | 0;
  const hf = (k: number) => Math.hypot((k % W) - gi, ((k / W) | 0) - gj) * hScale;
  g[start] = 0; q.push(hf(start), start);
  while (q.size) {
    const [, k] = q.pop(); if (closed[k]) continue; closed[k] = 1;
    if (k === goal) { const p = [k]; let c = k; while (came[c]! >= 0) { c = came[c]!; p.push(c); } return p.reverse(); }
    const i = k % W, j = (k / W) | 0;
    for (const [di, dj, dl] of D8) { const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
      const n = nj * W + ni; if (closed[n]) continue; const c = cost(k, n, dl); if (!isFinite(c)) continue;
      const ng = g[k]! + c; if (ng < g[n]!) { g[n] = ng; came[n] = k; q.push(ng + hf(n), n); } }
  }
  return null;
}

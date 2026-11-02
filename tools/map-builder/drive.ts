// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Scripted Forest Basin build. Logs in a crew of builder characters on a local
 * MAP_BUILDER_DEV server and casts the real Map-tab spells (Raise, Lower,
 * Smooth, Meadow, Mountain, Walk) at ground targets until the live overlay
 * matches `forest-basin-plan.ts`. One observer keeps the live heights from
 * zone/patch broadcasts, so every stroke is chosen from what the server says.
 *
 *   tools/map-builder/serve.sh            # in another shell
 *   tsx tools/map-builder/drive.ts [heights|paint|all]
 */
import {
  FOREST_BASIN_BOUNDS,
  FB_ASCENTS,
  FB_BRIDGES,
  forestBasinStandHeight,
  forestBasinWorldOfCell,
  fbAscentAt,
  fbDesignWater,
} from "@bellgrave/config";
import { encodeBrushTarget } from "@bellgrave/combat";
import { BuilderClient } from "./client";
import { planCell, planHeight } from "./forest-basin-plan";

const URL = process.env.WS ?? "ws://localhost:8797";
const CREW = Number(process.env.CREW ?? 4);
const CELL = 0.5;
const { minX, minZ, maxX, maxZ } = FOREST_BASIN_BOUNDS;
const W = Math.round((maxX - minX) / CELL) + 1;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const NAMES = ["Fernwright", "Ashhand", "Corliss", "Tamsin", "Bramwell", "Odile", "Harrow", "Wenna", "Pellam", "Isolde", "Garrick", "Maudlin"];

const H = new Float32Array(W * W);
let lastPatchAt = 0;
const T = new Float32Array(W * W);
const BIOME = new Uint8Array(W * W); // live biome byte (0 = unedited)

type Job = { id: string; target: string };

class Crew {
  bots: BuilderClient[] = [];
  ready: Map<BuilderClient, Record<string, number>> = new Map();
  casts = 0;
  errors = 0;
  async start(n: number) {
    for (let k = 0; k < n; k++) {
      const tails = ["wick", "ford", "dale", "mere", "holt", "by", "ton", "well", "stead", "worth", "combe", "ley"];
      let b!: BuilderClient;
      for (let attempt = 0; ; attempt++) {
        const nm = NAMES[(k + Math.floor(Math.random() * 97)) % NAMES.length]! + tails[Math.floor(Math.random() * tails.length)]!;
        b = new BuilderClient(URL, nm);
        b.parseBig = k === 0;
        try {
          await b.connect();
          break;
        } catch (e) {
          b.close();
          if (attempt > 6) throw e;
        }
      }
      if (k === 0) watch(b); // observer must hear the zone/overlay that map_enter sends
      b.cast("map_enter");
      this.bots.push(b);
      this.ready.set(b, {});
    }
    await sleep(1200);
  }
  async run(jobs: Job[], pace: Record<string, number>) {
    let next = 0;
    const work = this.bots.map(async (b) => {
      const ready = this.ready.get(b)!;
      while (next < jobs.length) {
        const j = jobs[next++]!;
        const wait = (ready[j.id] ?? 0) - Date.now();
        if (wait > 0) await sleep(wait);
        b.cast(j.id, j.target);
        this.casts++;
        ready[j.id] = Date.now() + (pace[j.id] ?? 300);
        // keep the socket from flooding: at most one cast per 70 ms per bot
        await sleep(70);
      }
    });
    await Promise.all(work);
    // let the server drain its queue: wait until patches stop arriving
    await sleep(1000);
    while (Date.now() - lastPatchAt < 2500) await sleep(500);
  }
  notReady(): number {
    return this.bots.reduce((n, b) => n + b.logs.filter((l) => /not ready/.test(l)).length, 0);
  }
  close() {
    for (const b of this.bots) b.close();
  }
}

const PACE = { map_raise: 380, map_lower: 380, map_smooth: 520, map_biome_meadow: 300, map_biome_mountain: 300, map_biome_grass: 300, map_walk: 300 };

function initState() {
  for (let j = 0; j < W; j++) {
    for (let i = 0; i < W; i++) {
      const { x, z } = forestBasinWorldOfCell(i, j);
      H[j * W + i] = forestBasinStandHeight(x, z);
      T[j * W + i] = planHeight(x, z);
    }
  }
}

function watch(obs: BuilderClient) {
  obs.listeners.push((m) => {
    const cells = m.type === "zone/patch" || m.type === "zone/overlay" ? m.cells : null;
    if (!cells) return;
    lastPatchAt = Date.now();
    for (const c of cells) {
      const k = c.j * W + c.i;
      if (k < 0 || k >= H.length) continue;
      H[k] = c.heightCm / 100;
      BIOME[k] = c.biome ?? 0;
    }
  });
}

function stats(): { rms: number; max: number; at: string } {
  let s = 0, mx = 0, at = 0;
  for (let k = 0; k < H.length; k++) {
    const d = Math.abs(T[k]! - H[k]!);
    s += d * d;
    if (d > mx) { mx = d; at = k; }
  }
  const p = forestBasinWorldOfCell(at % W, Math.floor(at / W));
  return { rms: Math.sqrt(s / H.length), max: mx, at: `${p.x},${p.z} T=${T[at]!.toFixed(2)} H=${H[at]!.toFixed(2)}` };
}

/** Raise/Lower strokes at radius r on a jittered grid, sized by weighted least squares on the residual. */
function heightJobs(r: number, gain: number, thr: number, seed: number): Job[] {
  const jobs: Job[] = [];
  const sp = Math.max(1, r * 0.62);
  const rc = Math.ceil(r / CELL);
  let row = 0;
  for (let cz = minZ + 2 + ((seed * 0.37) % 1) * sp; cz <= maxZ - 2; cz += sp, row++) {
    for (let cx = minX + 2 + (row % 2) * sp * 0.5 + ((seed * 0.61) % 1) * sp; cx <= maxX - 2; cx += sp) {
      const ci = Math.round((cx - minX) / CELL), cj = Math.round((cz - minZ) / CELL);
      let num = 0, den = 0;
      for (let dj = -rc; dj <= rc; dj++) {
        const j = cj + dj;
        if (j < 0 || j >= W) continue;
        for (let di = -rc; di <= rc; di++) {
          const i = ci + di;
          if (i < 0 || i >= W) continue;
          const d = Math.hypot(di * CELL, dj * CELL) / r;
          if (d > 1) continue;
          const w = 0.5 * (1 + Math.cos(Math.PI * d));
          const k = j * W + i;
          num += w * (T[k]! - H[k]!);
          den += w * w;
        }
      }
      if (den === 0) continue;
      let s = (gain * num) / den;
      if (Math.abs(s) < thr) continue;
      s = Math.max(-2, Math.min(2, s));
      const strength = Math.max(0.05, Math.abs(s));
      jobs.push({ id: s > 0 ? "map_raise" : "map_lower", target: encodeBrushTarget(cx, cz, r, strength) });
    }
  }
  // interleave raise/lower so each bot can use both recasts
  const up = jobs.filter((j) => j.id === "map_raise"), dn = jobs.filter((j) => j.id === "map_lower");
  const out: Job[] = [];
  for (let k = 0; k < Math.max(up.length, dn.length); k++) {
    if (up[k]) out.push(up[k]!);
    if (dn[k]) out.push(dn[k]!);
  }
  return out;
}

async function heights(crew: Crew) {
  // radius:gain:threshold:repeats. Brushes overlap ~2.4x at 0.62r spacing, so gain stays under 0.42.
  const schedule = (process.env.SCHEDULE ?? "10:0.38:0.1:3,6:0.38:0.08:3,3.5:0.38:0.08:2,2:0.4:0.1:2,1.2:0.4:0.12:1")
    .split(",")
    .map((s) => s.split(":").map(Number) as [number, number, number, number]);
  let seed = 1;
  for (const [r, gain, thr, reps] of schedule) {
    for (let k = 0; k < reps; k++) {
      const jobs = heightJobs(r, gain, thr, seed++);
      if (jobs.length === 0) break;
      const t0 = Date.now();
      await crew.run(jobs, PACE);
      const st = stats();
      console.log(`r=${r} pass ${k + 1}: ${jobs.length} strokes in ${((Date.now() - t0) / 1000).toFixed(0)}s · rms ${st.rms.toFixed(3)} max ${st.max.toFixed(2)} @${st.at} · not-ready ${crew.notReady()}`);
    }
  }
}

/** Paint meadow glades, mountain cliff faces (which also blocks), then reopen the ascents. */
async function paint(crew: Crew) {
  // Re-derive cell classes from the *live* heights (slope from the sculpted ground).
  const step = 2; // 1 m sample of the 0.5 m grid
  const jobs: Job[] = [];
  const walk: Job[] = [];
  for (let j = step; j < W - step; j += 3) {
    for (let i = step; i < W - step; i += 3) {
      const { x, z } = forestBasinWorldOfCell(i, j);
      const k = j * W + i;
      const gx = (H[k + step]! - H[k - step]!) / (2 * step * CELL);
      const gz = (H[k + step * W]! - H[k - step * W]!) / (2 * step * CELL);
      const c = planCell(x, z, Math.hypot(gx, gz));
      if (c.biome === "mountain") jobs.push({ id: "map_biome_mountain", target: encodeBrushTarget(x, z, 1.1, 1) });
      else if (c.biome === "meadow" && (i + j) % 6 === 0) jobs.push({ id: "map_biome_meadow", target: encodeBrushTarget(x, z, 2.2, 1) });
    }
  }
  // Ascent routes and bridge abutments must stay open even where the slope reads as cliff.
  for (const a of FB_ASCENTS) {
    for (let s = 0; s < a.points.length - 1; s++) {
      const p = a.points[s]!, q = a.points[s + 1]!;
      const n = Math.ceil(Math.hypot(q.x - p.x, q.z - p.z) / 1.5);
      for (let t = 0; t <= n; t++) {
        const x = p.x + ((q.x - p.x) * t) / n, z = p.z + ((q.z - p.z) * t) / n;
        walk.push({ id: "map_walk", target: encodeBrushTarget(x, z, a.halfWidth + 0.4, 1) });
        walk.push({ id: "map_biome_grass", target: encodeBrushTarget(x, z, a.halfWidth, 1) });
      }
    }
  }
  for (const b of FB_BRIDGES) {
    for (const e of [b.a, b.b]) walk.push({ id: "map_walk", target: encodeBrushTarget(e.x, e.z, b.halfWidth + 1, 1) });
  }
  void fbAscentAt;
  void fbDesignWater;
  // interleave by ability so recasts overlap
  const byId = new Map<string, Job[]>();
  for (const jb of jobs) (byId.get(jb.id) ?? byId.set(jb.id, []).get(jb.id)!).push(jb);
  const lists = [...byId.values()];
  const mixed: Job[] = [];
  for (let k = 0; lists.some((l) => k < l.length); k++) for (const l of lists) if (l[k]) mixed.push(l[k]!);
  let t0 = Date.now();
  await crew.run(mixed, PACE);
  console.log(`paint: ${mixed.length} strokes in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  t0 = Date.now();
  await crew.run(walk, PACE);
  console.log(`ascents/bridges opened: ${walk.length} strokes in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}

async function main() {
  const mode = process.argv[2] ?? "all";
  console.log("planning target…");
  initState();
  const crew = new Crew();
  await crew.start(CREW);
  await sleep(3000);
  console.log("start", stats());
  if (mode === "heights" || mode === "all") await heights(crew);
  if (mode === "paint" || mode === "all") await paint(crew);
  console.log("done", stats(), "casts", crew.casts);
  crew.close();
}
void main();

/**
 * Anchor audit (untracked). Checks, per zone, that every anchor is on walkable
 * ground and BFS-reachable from the zone spawn on a walk grid, and that every
 * gate/link connects to a walkable, reachable arrival in the destination zone.
 *
 * Run: packages/config/node_modules/.bin/tsx tools/check-anchors.ts [zoneId|all] [--cell=0.5] [--json] [--strict]
 * Exit code 1 if any FAIL (and with --strict, any WARN).
 */
import * as C from "../packages/config/src/index.ts";

type Anchor = { id: string; kind: string; x: number; z: number; src: string };
type Gate = { id: string; minX: number; maxX: number; minZ: number; maxZ: number; blocked: boolean; destZone: string | null };
type Zone = {
  id: string;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  walkable: (x: number, z: number) => boolean;
  spawn: { x: number; z: number };
  gates: Gate[];
  anchors: Anchor[];
};

const args = process.argv.slice(2);
const cell = Number(args.find((a) => a.startsWith("--cell="))?.slice(7) ?? 0.5);
const asJson = args.includes("--json");
const strict = args.includes("--strict");
const want = args.find((a) => !a.startsWith("--")) ?? "all";
/** Known, deferred items: still reported as WARN, but labelled so reviewers know they are expected. */
const KNOWN_DEFERRED: Record<string, string> = {
  forest_basin: "known: Forest Basin (Hush Wood) is left as main has it; deferred to #139 (map builder blanks the basin). See docs/worldgen/KNOWN-DEFERRED.md",
};
const SNAP = 2.0; // metres an interactable may sit off walkable ground

function arrivalsInto(zone: string): Anchor[] {
  return C.ZONE_LINKS.filter((l) => l.to === zone).map((l) => ({
    id: `arrival:${l.id}`, kind: "arrival", x: l.spawn.x, z: l.spawn.z, src: "packages/config/src/zone-links.ts",
  }));
}

function buildZones(): Zone[] {
  const ph = "packages/config/src/pale-hollow.ts";
  const phf = "packages/config/src/pale-hollow-field.ts";
  const zones: Zone[] = [];
  zones.push({
    id: "pale_hollow",
    bounds: C.PALE_HOLLOW_BOUNDS,
    walkable: C.paleHollowWalkable,
    spawn: C.PH_HUB_SPAWN,
    gates: [{ ...C.PH_ASH_ROAD, destZone: C.zoneLink("pale_hollow", C.PH_ASH_ROAD.id)?.to ?? null }],
    anchors: [
      { id: "PH_HUB_SPAWN", kind: "spawn", ...C.PH_HUB_SPAWN, src: ph },
      { id: "PH_OUTDOOR_SPAWN", kind: "spawn", ...C.PH_OUTDOOR_SPAWN, src: ph },
      ...C.PH_HUB_NPCS.map((n) => ({ id: n.id, kind: "npc:" + n.role, x: n.x, z: n.z, src: ph })),
      { id: C.PH_STORAGE_CHEST.id, kind: "npc:storage", x: C.PH_STORAGE_CHEST.x, z: C.PH_STORAGE_CHEST.z, src: ph },
      { id: C.PH_TRAINER.id, kind: "npc:spell_trainer", x: C.PH_TRAINER.x, z: C.PH_TRAINER.z, src: ph },
      ...C.PH_FIELD_NPCS.map((n) => ({ id: n.id, kind: "npc:quest_giver", x: n.x, z: n.z, src: phf })),
      ...C.PH_ALL_NODES.map((n) => ({ id: n.id, kind: "node:" + n.kind, x: n.x, z: n.z, src: ph })),
      ...C.PH_ALL_MOBS.map((m) => ({ id: m.id, kind: "mob", x: m.x, z: m.z, src: phf })),
      ...arrivalsInto("pale_hollow"),
    ],
  });
  for (const f of Object.values(C.ZONE_FIELDS)) {
    zones.push({
      id: f.id,
      bounds: f.bounds,
      walkable: f.walkable,
      spawn: f.spawn,
      gates: f.gates.map((g) => ({ ...g })),
      anchors: [{ id: `${f.id}:SPAWN`, kind: "spawn", x: f.spawn.x, z: f.spawn.z, src: "packages/config/src/" + f.id.replace("_", "-") + ".ts" }, ...arrivalsInto(f.id)],
    });
  }
  return zones;
}

type Grid = { z: Zone; w: number; h: number; walk: Uint8Array; reach: Uint8Array; idx: (x: number, z: number) => number; startOk: boolean };

function grid(z: Zone): Grid {
  const { minX, minZ, maxX, maxZ } = z.bounds;
  const w = Math.floor((maxX - minX) / cell) + 1, h = Math.floor((maxZ - minZ) / cell) + 1;
  const walk = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) walk[j * w + i] = z.walkable(minX + i * cell, minZ + j * cell) ? 1 : 0;
  const idx = (x: number, zz: number) => {
    const i = Math.round((x - minX) / cell), j = Math.round((zz - minZ) / cell);
    return i < 0 || j < 0 || i >= w || j >= h ? -1 : j * w + i;
  };
  const reach = new Uint8Array(w * h);
  const s = nearestWalk({ w, h, walk } as Grid, idx(z.spawn.x, z.spawn.z), 3 / cell);
  const startOk = s >= 0;
  if (startOk) {
    const q = new Int32Array(w * h); let qh = 0, qt = 0;
    q[qt++] = s; reach[s] = 1;
    while (qh < qt) {
      const c = q[qh++]!; const ci = c % w, cj = (c - ci) / w;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = ci + di, nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue;
        const n = nj * w + ni;
        if (reach[n] || !walk[n]) continue;
        if (di && dj && !(walk[cj * w + ni] && walk[nj * w + ci])) continue; // no corner cutting
        reach[n] = 1; q[qt++] = n;
      }
    }
  }
  return { z, w, h, walk, reach, idx, startOk };
}

function nearestWalk(g: Pick<Grid, "w" | "h" | "walk">, at: number, rCells: number, arr: Uint8Array = g.walk): number {
  if (at < 0) return -1;
  if (arr[at]) return at;
  const ai = at % g.w, aj = (at - ai) / g.w;
  let best = -1, bd = Infinity;
  const R = Math.ceil(rCells);
  for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) {
    const i = ai + di, j = aj + dj;
    if (i < 0 || j < 0 || i >= g.w || j >= g.h) continue;
    const d = di * di + dj * dj;
    if (d <= R * R && d < bd && arr[j * g.w + i]) { bd = d; best = j * g.w + i; }
  }
  return best;
}

type Res = { zone: string; id: string; kind: string; x: number; z: number; status: "PASS" | "WARN" | "FAIL"; why: string };

function main() {
  const zones = buildZones();
  const byId = new Map(zones.map((z) => [z.id, z]));
  const grids = new Map<string, Grid>();
  const g = (id: string) => { let r = grids.get(id); if (!r) { r = grid(byId.get(id)!); grids.set(id, r); } return r; };
  const out: Res[] = [];
  const sel = want === "all" ? zones : zones.filter((z) => z.id === want);
  if (!sel.length) { console.error(`unknown zone ${want}; known: ${zones.map((z) => z.id).join(", ")}`); process.exit(2); }

  for (const z of sel) {
    const G = g(z.id);
    if (!G.startOk) out.push({ zone: z.id, id: "SPAWN", kind: "spawn", ...z.spawn, status: "FAIL", why: "no walkable cell within 3 m of spawn" });
    const total = G.walk.reduce((a, b) => a + b, 0), reached = G.reach.reduce((a, b) => a + b, 0);
    out.push({ zone: z.id, id: "grid", kind: "info", x: 0, z: 0, status: "PASS", why: `walk cells ${total}, reachable from spawn ${reached} (${((100 * reached) / Math.max(1, total)).toFixed(1)}%)` });
    for (const a of z.anchors) {
      const i = G.idx(a.x, a.z);
      const exact = z.walkable(a.x, a.z);
      let status: Res["status"] = "PASS", why = "walkable+reachable";
      if (i < 0) { out.push({ zone: z.id, ...a, status: "FAIL", why: "outside zone bounds" }); continue; }
      const strictKind = a.kind === "spawn" || a.kind === "arrival" || a.kind === "mob";
      if (!exact) {
        const n = nearestWalk(G, i, SNAP / cell);
        if (n < 0 || strictKind) { status = n < 0 ? "FAIL" : "WARN"; why = n < 0 ? `not walkable, no walkable cell within ${SNAP} m` : "point itself not walkable (walkable cell within 2 m)"; }
        else { status = "PASS"; why = "on blocker, walkable within 2 m (interactable)"; }
      }
      const r = nearestWalk(G, i, SNAP / cell, G.reach);
      if (r < 0 && status !== "FAIL") { status = "FAIL"; why = "not reachable from zone spawn (separate walk component)"; }
      out.push({ zone: z.id, ...a, status, why });
    }
    for (const gt of z.gates) {
      const base = { zone: z.id, id: `gate:${gt.id}`, kind: "gate", x: (gt.minX + gt.maxX) / 2, z: (gt.minZ + gt.maxZ) / 2 };
      if (gt.blocked) { out.push({ ...base, status: "WARN", why: KNOWN_DEFERRED[z.id] ? `gate blocked (${KNOWN_DEFERRED[z.id]})` : "gate blocked" }); continue; }
      let any = false;
      for (let x = gt.minX; x <= gt.maxX && !any; x += cell) for (let zz = gt.minZ; zz <= gt.maxZ && !any; zz += cell) { const k = G.idx(x, zz); if (k >= 0 && G.reach[k]) any = true; }
      const link = C.zoneLink(z.id, gt.id);
      if (!any) { out.push({ ...base, status: "FAIL", why: "no reachable cell inside gate rect" }); continue; }
      if (!link) { out.push({ ...base, status: gt.destZone ? "FAIL" : "WARN", why: "no ZONE_LINKS row for gate" }); continue; }
      const dz = byId.get(link.to);
      if (!dz) { out.push({ ...base, status: "FAIL", why: `dest zone ${link.to} has no walk model` }); continue; }
      const DG = g(dz.id); const k = DG.idx(link.spawn.x, link.spawn.z);
      const problems: string[] = [];
      if (k < 0) problems.push("arrival outside dest bounds");
      else {
        if (!dz.walkable(link.spawn.x, link.spawn.z)) problems.push("arrival not walkable (travelAt refuses travel)");
        if (!DG.reach[k]) problems.push("arrival not reachable from dest spawn");
      }
      for (const rg of dz.gates) if (!rg.blocked && link.spawn.x >= rg.minX && link.spawn.x <= rg.maxX && link.spawn.z >= rg.minZ && link.spawn.z <= rg.maxZ) problems.push(`arrival inside dest gate ${rg.id} (bounce loop)`);
      const back = C.ZONE_LINKS.find((l) => l.from === link.to && l.to === z.id);
      if (!back) problems.push("no return link");
      out.push({ ...base, status: problems.length ? "FAIL" : "PASS", why: problems.length ? problems.join("; ") : `-> ${link.to} @(${link.spawn.x},${link.spawn.z}) ok; return via ${back!.gate}` });
    }
  }
  // orphan links
  for (const l of C.ZONE_LINKS) {
    const z = byId.get(l.from);
    if (!z || !z.gates.some((gt) => gt.id === l.gate)) out.push({ zone: l.from, id: `link:${l.id}`, kind: "link", x: l.spawn.x, z: l.spawn.z, status: "FAIL", why: "link references missing gate/zone" });
  }

  if (asJson) { console.log(JSON.stringify(out, null, 1)); }
  else {
    for (const z of sel) {
      const rs = out.filter((r) => r.zone === z.id);
      const c = (s: string) => rs.filter((r) => r.status === s).length;
      console.log(`\n== ${z.id}: ${c("PASS")} pass, ${c("WARN")} warn, ${c("FAIL")} fail  [${rs.find((r) => r.id === "grid")?.why}]`);
      for (const r of rs) if (r.status !== "PASS" || r.kind === "gate") console.log(`  ${r.status} ${r.kind.padEnd(16)} ${r.id.padEnd(26)} (${r.x.toFixed(1)}, ${r.z.toFixed(1)})  ${r.why}`);
    }
  }
  const f = out.filter((r) => r.status === "FAIL").length, w = out.filter((r) => r.status === "WARN").length;
  console.log(`\nTOTAL anchors+gates checked: ${out.length - sel.length}; FAIL ${f}; WARN ${w}; cell ${cell} m`);
  process.exit(f || (strict && w) ? 1 : 0);
}
main();

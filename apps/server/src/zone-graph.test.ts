import assert from "node:assert/strict";
import test from "node:test";
import {
  PH_ASH_ROAD,
  ZONES,
  ZONE_FIELDS,
  ZONE_LINKS,
  fieldById,
  fieldClampMove,
  fieldNav,
  paleHollowClampMove,
  paleHollowWalkable,
  PLAYER_SPEED,
  TICK_MS,
} from "@bellgrave/config";
import { paleHollowFindPath } from "./nav-grid";

const START = "pale_hollow";
const PLAYABLE = [START, ...Object.keys(ZONE_FIELDS)];
/** Gates drawn in a field that lead nowhere yet. A new unlinked open gate fails the test. */
const CLOSED_GATES = new Set(["forest_basin:north-pass", "forest_basin:west-gap", "forest_basin:northwest-gap", "forest_basin:southwest-gap"]);

function gateOf(zone: string, gate: string) {
  return zone === START ? PH_ASH_ROAD : ZONE_FIELDS[zone]?.gates.find((g) => g.id === gate);
}

test("every playable zone is registered on the server", () => {
  for (const id of PLAYABLE) {
    assert.ok(ZONES[id as keyof typeof ZONES], `${id} missing from ZONES`);
    if (id !== START) assert.ok(fieldById(id), `${id} has no field the server can load`);
  }
});

test("zone lines point at defined zones and every one has a way back", () => {
  for (const l of ZONE_LINKS) {
    assert.ok(PLAYABLE.includes(l.from), `${l.id} leaves an undefined zone`);
    assert.ok(PLAYABLE.includes(l.to), `${l.id} points at an undefined zone`);
    assert.ok(gateOf(l.from, l.gate), `${l.id} uses a gate its zone does not draw`);
    assert.ok(ZONE_LINKS.some((r) => r.from === l.to && r.to === l.from), `${l.id} is one-way`);
  }
});

test("every zone is reachable from the start and none is orphaned", () => {
  const seen = new Set([START]);
  const queue = [START];
  while (queue.length) {
    const z = queue.shift()!;
    for (const l of ZONE_LINKS) if (l.from === z && !seen.has(l.to)) (seen.add(l.to), queue.push(l.to));
  }
  for (const id of PLAYABLE) assert.ok(seen.has(id), `${id} cannot be reached from Pale Hollow`);
});

test("open gates are wired, and arrivals land inside bounds", () => {
  for (const [id, f] of Object.entries(ZONE_FIELDS)) {
    for (const g of f.gates) {
      if (g.blocked || CLOSED_GATES.has(`${id}:${g.id}`)) continue;
      assert.ok(ZONE_LINKS.some((l) => l.from === id && l.gate === g.id), `${id}:${g.id} is open but leads nowhere`);
    }
  }
  for (const l of ZONE_LINKS) {
    if (l.to === START) continue;
    const b = ZONE_FIELDS[l.to]!.bounds;
    assert.ok(l.spawn.x >= b.minX && l.spawn.x <= b.maxX && l.spawn.z >= b.minZ && l.spawn.z <= b.maxZ, `${l.id} lands outside bounds`);
  }
});

test("a player can walk from each arrival to each exit with the server's path and movement", () => {
  for (const l of ZONE_LINKS) {
    const gate = gateOf(l.from, l.gate)!;
    const gx = (gate.minX + gate.maxX) / 2;
    const gz = (gate.minZ + gate.maxZ) / 2;
    const starts = ZONE_LINKS.filter((r) => r.to === l.from).map((r) => r.spawn);
    for (const s of starts) {
      let x = s.x;
      let z = s.z;
      for (let leg = 0; leg < 6; leg++) {
        if (x >= gate.minX && x <= gate.maxX && z >= gate.minZ && z <= gate.maxZ) break;
        const path = paleHollowFindPath(x, z, gx, gz, fieldNav(l.from));
        if (!path.length) break;
        let stalled = false;
        for (const n of path) {
          if (stalled) break; // the server drops the route here; the next click plans again from this spot
          for (let i = 0; i < 4000; i++) {
            const d = Math.hypot(n.x - x, n.z - z);
            if (d < 0.2) break;
            const s = Math.min(d, (PLAYER_SPEED * TICK_MS) / 1000); // one server tick of walking
            const tx = x + ((n.x - x) / d) * s;
            const tz = z + ((n.z - z) / d) * s;
            const c = fieldClampMove(l.from, x, z, tx, tz) ?? paleHollowClampMove(x, z, tx, tz);
            if (Math.hypot(c.x - x, c.z - z) < 1e-4) { stalled = true; break; } // server stops against a blocker
            x = c.x;
            z = c.z;
          }
        }
      }
      const inGate = x >= gate.minX && x <= gate.maxX && z >= gate.minZ && z <= gate.maxZ;
      assert.ok(inGate, `${l.id}: walking from (${s.x}, ${s.z}) stops at (${x.toFixed(1)}, ${z.toFixed(1)})`);
      if (l.from === START) assert.ok(paleHollowWalkable(gx, gz));
    }
  }
});

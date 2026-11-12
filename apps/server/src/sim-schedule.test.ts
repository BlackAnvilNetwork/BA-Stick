import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { SNAPSHOT_HZ, SNAPSHOT_MS, TICK_HZ, TICK_MS } from "@bellgrave/config";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "index.ts"), "utf8");
const simBody = src.slice(src.indexOf("function tickSimBody"), src.indexOf("function gatherToolFor"));

test("snapshots are scheduled independently of the sim tick", () => {
  assert.equal(TICK_HZ, 20);
  assert.equal(TICK_MS, 50);
  assert.equal(SNAPSHOT_HZ, 20);
  assert.equal(SNAPSHOT_MS, 50);
  assert.match(src, /SNAPSHOT_MS/);
  assert.match(src, /function armSnapshotTick\(/);
  assert.match(src, /function runSnapshotTick\(/);
  assert.match(src, /function collectSnapshotJobs\(/);
  assert.match(src, /function flushSnapshotJobs\(/);
  assert.match(src, /encodeSnapshotPayloads/);
  assert.match(src, /pumpSnapshotEncode/);
  assert.match(src, /p\.ws\.send\(text\)/);
  assert.match(src, /broadcastSnapshots\(\);/);
  assert.doesNotMatch(simBody, /broadcastSnapshots/);
  assert.doesNotMatch(simBody, /JSON\.stringify/);
  assert.match(src, /snapshotDue \+= SNAPSHOT_MS/);
  assert.match(src, /armWorldTick\(\);\s*armSnapshotTick\(\);/s);
  assert.match(src, /moveSeq: p\.lastMoveSeq,/);
  assert.match(src, /simAt: Date\.now\(\),/);
});

test("sim tick is split into locomotion, combat intent, and mob brain phases", () => {
  assert.match(src, /function tickPlayerIntent\(/);
  assert.match(src, /function tickPlayerLocomotion\(/);
  assert.match(src, /function tickPlayerOffense\(/);
  assert.match(src, /function tickMobBrain\(/);
  assert.match(src, /function tickMobAttacks\(/);
  assert.match(simBody, /tickPlayerIntent\(p, now\)/);
  assert.match(simBody, /tickPlayerLocomotion\(p, now, dt\)/);
  assert.match(simBody, /tickPlayerOffense\(p, now\)/);
  assert.match(simBody, /tickMobBrain\(now, dt, zonePlayers\)/);
  assert.match(simBody, /tickMobAttacks\(now, zonePlayers\)/);
  const brainAt = simBody.indexOf("tickMobBrain(now, dt, zonePlayers)");
  const playerLoopAt = simBody.indexOf("for (const p of players.values())");
  const atkAt = simBody.indexOf("tickMobAttacks(now, zonePlayers)");
  assert.ok(brainAt >= 0 && playerLoopAt >= 0 && brainAt < playerLoopAt, "mob footsteps before player locomotion");
  assert.ok(atkAt > playerLoopAt, "mob swings after this tick's player move");
  assert.match(simBody, /playersByZone\(\)/);
  assert.doesNotMatch(simBody, /mobs\.indexOf\(mob\)/);
  assert.match(src, /function mobNeedsMaintain\(/);
  assert.match(src, /function liveMobPrey\(/);
  assert.match(src, /simLodShouldStep\(lod, tick\)/);
  assert.match(src, /anyPointWithin\(mob\.x, mob\.z, watchers, SNAPSHOT_INTEREST_M\)/);
  assert.match(src, /p\.snapPending = true/);
  assert.match(src, /if \(p\.snapPending\) pending\.push\(p\)/);
  assert.match(src, /wireSnapBackpressureDrain/);
  assert.match(src, /if \(msg\.type === "snapshot"\)/);
  assert.match(src, /pumpSnapshotEncode\(\[/);
  assert.match(src, /lastDashAt: p\.lastDashAt/);
  assert.match(src, /function tickMobAttacks\(/);
  assert.match(src, /liveMobPrey\(mob\)/);
  assert.match(src, /canMeleeHit\(feet, p\.facing/);
  // Close-and-hit order: intent, then move, then swing.
  const intentAt = simBody.indexOf("tickPlayerIntent(p, now)");
  const moveAt = simBody.indexOf("tickPlayerLocomotion(p, now, dt)");
  const hitAt = simBody.indexOf("tickPlayerOffense(p, now)");
  assert.ok(intentAt < moveAt && moveAt < hitAt);
});

test("tickMobBrain still roams when LOD skips the aggro scan", () => {
  const brain = src.slice(src.indexOf("function tickMobBrain"), src.indexOf("function tickMobAttacks"));
  assert.match(brain, /if \(simLodShouldStep\(lod, tick\)\)/);
  assert.doesNotMatch(brain, /if \(!simLodShouldStep\(lod, tick\)\) \{\s*continue;/);
  assert.match(brain, /if \(!mob\.targetId\) tickMobRoam\(mob, now, dt\)/);
  assert.match(brain, /for \(const pl of watchers\)/);
  assert.doesNotMatch(brain, /for \(const pl of players\.values\(\)\)/);
});

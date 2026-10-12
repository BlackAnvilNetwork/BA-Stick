/**
 * Regression tests for the 2026-10-05 self-audit (AUDIT-2026-10-05.md).
 * Every test runs in its own temp dir. None touches apps/server/data.
 */
import { MAX_QUANTITY_FILLS, planQuantityFills, type AskQuote } from "@bellgrave/protocol";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { hostname, tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { acquireDataDirLock, DATA_DIR_LOCK_FILE, dataDirLockedByOther, LOCK_FRESH_MS, readDataDirLock } from "./data-dir-lock";
import { LokWorld, MAX_FILLS_PER_BUY_MESSAGE } from "./lok-world";

function tmp(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

function deposit(lok: LokWorld, tokenId: string, amount: string, nonce: string) {
  lok.noteCustodyInbound({ kind: "depositKek", tokenId, nonce, amount });
  return lok.depositKek(tokenId, amount, nonce);
}

/** Two characters, a deposit, and a send: four journal lines after the first snapshot. */
function seeded(dir: string) {
  const lok = LokWorld.open(dir, undefined, {});
  const a = lok.spawn("char-a", "Ada", 0);
  const b = lok.spawn("char-b", "Bea", 1);
  assert.ok(a.ok && b.ok);
  if (!a.ok || !b.ok) throw new Error("spawn failed");
  assert.equal(deposit(lok, a.tokenId, "10", "1").ok, true);
  assert.equal(lok.sendKek(a.tokenId, b.tokenId, "1").ok, true);
  return { lok, a: a.tokenId, b: b.tokenId };
}

// ---------------------------------------------------------------- data-dir lock

test("a second live process cannot open the same lok data dir", () => {
  const dir = tmp("lok-lock-live-");
  // The parent of the test process is alive and is not us.
  writeFileSync(
    join(dir, DATA_DIR_LOCK_FILE),
    JSON.stringify({ pid: process.ppid, host: hostname(), startedAt: "2026-10-05T00:00:00.000Z" }),
  );
  assert.equal(dataDirLockedByOther(dir)?.pid, process.ppid);
  assert.throws(() => LokWorld.open(dir, undefined, {}), /already open by live pid/);
  assert.equal(existsSync(join(dir, "lok-world.json")), false, "a refused open must not write the log");
  assert.equal(existsSync(join(dir, "lok-bind.json")), false, "a refused open must not write the bind file");
  // Explicit operator override still works.
  const shared = LokWorld.open(dir, undefined, { LOK_ALLOW_SHARED_DATA_DIR: "1" });
  assert.equal(shared.length, 0);
});

test("a stale lock from a dead pid is taken over and the same process may reopen", () => {
  const dir = tmp("lok-lock-stale-");
  const dead = spawnSync(process.execPath, ["-e", ""]).pid;
  assert.ok(typeof dead === "number" && dead > 0);
  writeFileSync(join(dir, DATA_DIR_LOCK_FILE), JSON.stringify({ pid: dead, host: hostname(), startedAt: "x" }));
  const lok = LokWorld.open(dir, undefined, {});
  assert.equal(readDataDirLock(dir)?.pid, process.pid);
  assert.equal(dataDirLockedByOther(dir), null);
  const again = LokWorld.open(dir, undefined, {});
  assert.equal(again.length, lok.length);
  acquireDataDirLock(dir); // idempotent for the holder
});

test("a lock held on another host is refused", () => {
  const dir = tmp("lok-lock-host-");
  writeFileSync(join(dir, DATA_DIR_LOCK_FILE), JSON.stringify({ pid: process.pid, host: "some-other-host", startedAt: "x" }));
  assert.throws(() => LokWorld.open(dir, undefined, {}), /locked by pid/);
});

// ---------------------------------------------------------------- journal tail and seq

test("a torn final journal line is cut off so the next append does not corrupt the journal", () => {
  const dir = tmp("lok-torn-");
  const { lok, a, b } = seeded(dir);
  const len = lok.length;
  const journal = join(dir, "lok-world.jsonl");
  appendFileSync(journal, '{"seq":' + (len + 1) + ',"cmd":{"op":"sendKek","from":"' + a);
  const reopened = LokWorld.open(dir, undefined, {});
  assert.equal(reopened.length, len);
  assert.equal(readFileSync(journal, "utf8").endsWith("\n"), true);
  assert.equal(readdirSync(dir).some((name) => name.startsWith("lok-world.jsonl.torn-")), true);
  // Before the fix this append was concatenated onto the fragment and the next open threw.
  assert.equal(reopened.sendKek(a, b, "1").ok, true);
  const third = LokWorld.open(dir, undefined, {});
  assert.equal(third.length, len + 1);
  assert.equal(third.kekOf(b), "2");
});

test("a complete final journal record without its newline is kept and terminated", () => {
  const dir = tmp("lok-nonl-");
  const { lok, a, b } = seeded(dir);
  const len = lok.length;
  const journal = join(dir, "lok-world.jsonl");
  const text = readFileSync(journal, "utf8");
  writeFileSync(journal, text.slice(0, -1));
  const reopened = LokWorld.open(dir, undefined, {});
  assert.equal(reopened.length, len);
  assert.equal(reopened.kekOf(b), "1");
  assert.equal(reopened.sendKek(a, b, "1").ok, true);
  const third = LokWorld.open(dir, undefined, {});
  assert.equal(third.length, len + 1);
  assert.equal(third.kekOf(b), "2");
});

test("a duplicated journal line is refused instead of applied twice", () => {
  const dir = tmp("lok-dup-");
  const { b } = seeded(dir);
  const journal = join(dir, "lok-world.jsonl");
  const lines = readFileSync(journal, "utf8").split("\n").filter(Boolean);
  const last = lines[lines.length - 1]!;
  assert.match(last, /sendKek/);
  appendFileSync(journal, last + "\n");
  // Without the seq check the engine accepts the second sendKek and b ends with 2 KEK.
  assert.throws(() => LokWorld.open(dir, undefined, {}), /seq mismatch/);
  void b;
});

// ---------------------------------------------------------------- bind reconcile

test("bind rows dropped by reconcile are backed up before lok-bind.json is rewritten", () => {
  const dir = tmp("lok-bind-drop-");
  seeded(dir);
  const bindPath = join(dir, "lok-bind.json");
  const bind = JSON.parse(readFileSync(bindPath, "utf8")) as { chars: { charId: string; tokenId: string; name: string; job: number; wallet?: string }[] };
  bind.chars.push({ charId: "c_lost", tokenId: "999", name: "Lost", job: 0, wallet: "0x" + "ab".repeat(20) });
  writeFileSync(bindPath, JSON.stringify(bind));
  LokWorld.open(dir, undefined, {});
  const after = JSON.parse(readFileSync(bindPath, "utf8")) as { chars: { charId: string }[] };
  assert.equal(after.chars.some((row) => row.charId === "c_lost"), false);
  const backup = readdirSync(dir).find((name) => name.startsWith("lok-bind.dropped-"));
  assert.ok(backup, "a dropped-row backup is written");
  const saved = JSON.parse(readFileSync(join(dir, backup!), "utf8")) as { chars: { charId: string; wallet?: string }[] };
  assert.equal(saved.chars[0]?.charId, "c_lost");
  assert.equal(saved.chars[0]?.wallet, "0x" + "ab".repeat(20));
});

// ---------------------------------------------------------------- quantity-buy plan

test("the UI quantity plan uses the server's per-message fill cap", () => {
  assert.equal(MAX_QUANTITY_FILLS, MAX_FILLS_PER_BUY_MESSAGE);
  const asks: AskQuote[] = Array.from({ length: MAX_QUANTITY_FILLS + 5 }, (_, i) => ({
    id: String(i + 1),
    seller: "seller",
    itemId: 7,
    amount: "1",
    minPrice: "3",
    listedAt: 1000 + i,
    book: true,
  }));
  const plan = planQuantityFills(asks, "buyer", 7, 1000);
  assert.equal(plan.fills.length, MAX_QUANTITY_FILLS);
  assert.equal(plan.filled, String(MAX_QUANTITY_FILLS));
  assert.equal(plan.short, true);
  assert.equal(plan.capped, true);
  const small = planQuantityFills(asks, "buyer", 7, 3);
  assert.equal(small.fills.length, 3);
  assert.equal(small.capped, undefined);
});

// ---------------------------------------------------------------- follow-ups from the #210 review

test("an empty or unparseable lock younger than LOCK_FRESH_MS is held, not taken over", () => {
  for (const content of ["", '{"pid":']) {
    const dir = tmp("lok-lock-fresh-");
    const path = join(dir, DATA_DIR_LOCK_FILE);
    writeFileSync(path, content);
    assert.ok(dataDirLockedByOther(dir), "a just-created lock counts as held");
    assert.throws(() => acquireDataDirLock(dir, {}), /still being written/);
    assert.throws(() => LokWorld.open(dir, undefined, {}), /still being written/);
    assert.equal(readFileSync(path, "utf8"), content, "the owner's lock file is left in place");
    assert.equal(existsSync(join(dir, "lok-world.json")), false, "a refused open must not write the log");
  }
});

test("an empty lock older than LOCK_FRESH_MS is stale and taken over", () => {
  const dir = tmp("lok-lock-old-empty-");
  const path = join(dir, DATA_DIR_LOCK_FILE);
  writeFileSync(path, "");
  const later = Date.now() + LOCK_FRESH_MS + 1_000;
  assert.equal(dataDirLockedByOther(dir, later), null);
  acquireDataDirLock(dir, {}, () => later);
  assert.equal(readDataDirLock(dir)?.pid, process.pid);
});

// ---------------------------------------------------------------- vault play path removed (withdraw queue / deposit watcher gone)

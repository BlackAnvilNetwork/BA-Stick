/**
 * Seeded rolls for outcomes that change the log: hit, crit, loot, gold, gather
 * yield, mob abilities, Battle Mage resist, Purse Cut, and shiny promotion.
 *
 * The cursor (`game-roll.json`) is the sequence. The tape (`game-roll.jsonl`)
 * records each roll's tag and raw mix so a later pass can replay the same
 * order. Both flush once per tick, and only when a roll happened. Roam,
 * facing, and gather-node placement stay on Math.random.
 */
import { randomBytes } from "node:crypto";
import { closeSync, existsSync, fsyncSync, openSync, readFileSync, writeSync } from "node:fs";
import { join } from "node:path";
import { durableWrite } from "./durable-write";

const MASK = (1n << 64n) - 1n;
const GOLDEN = 0x9e3779b97f4a7c15n;
const UNIT_SCALE = 2 ** 53;

const CURSOR_NAME = "game-roll.json";
const TAPE_NAME = "game-roll.jsonl";

type TapeRoll = { n: number; tag: string; z: string };

let dataDir: string | null = null;
let seed = "unloaded";
let state = 0n;
let count = 0;
let flushedCount = 0;
let pending: TapeRoll[] = [];
const scripted: number[] = [];
let exitHook = false;

function mix(s: bigint): { state: bigint; z: bigint } {
  s = (s + GOLDEN) & MASK;
  let z = s;
  z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK;
  z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK;
  z = (z ^ (z >> 31n)) & MASK;
  return { state: s, z };
}

function unitFromZ(z: bigint): number {
  return Number(z >> 11n) / UNIT_SCALE;
}

function seedToState(raw: string): bigint {
  let h = 0xcbf29ce484222325n;
  for (const byte of Buffer.from(raw, "utf8")) {
    h = (h ^ BigInt(byte)) * 0x100000001b3n & MASK;
  }
  return h;
}

function cursorText(): string {
  return JSON.stringify({
    v: 1,
    seed,
    state: state.toString(16).padStart(16, "0"),
    count,
  }) + "\n";
}

function ensureExitHook(): void {
  if (exitHook) return;
  exitHook = true;
  process.on("beforeExit", () => {
    try {
      flushGameRoll();
    } catch (err) {
      console.error("[game-roll] flush failed", err);
    }
  });
}

/** Open or create the cursor in the lok data dir. Call once at server boot. */
export function loadGameRoll(dir: string): void {
  dataDir = dir;
  pending = [];
  const path = join(dir, CURSOR_NAME);
  if (!existsSync(path)) {
    const fromEnv = process.env.LOK_ROLL_SEED?.trim() ?? "";
    seed = fromEnv || randomBytes(32).toString("hex");
    state = seedToState(seed);
    count = 0;
    flushedCount = 0;
    durableWrite(path, cursorText());
    ensureExitHook();
    return;
  }
  let parsed: { seed?: unknown; state?: unknown; count?: unknown };
  try {
    parsed = JSON.parse(readFileSync(path, "utf8")) as { seed?: unknown; state?: unknown; count?: unknown };
  } catch {
    throw new Error("game-roll.json is not valid JSON");
  }
  if (typeof parsed.seed !== "string" || parsed.seed.length === 0) {
    throw new Error("game-roll.json is missing a seed");
  }
  if (typeof parsed.count !== "number" || !Number.isSafeInteger(parsed.count) || parsed.count < 0) {
    throw new Error("game-roll.json has a bad count");
  }
  seed = parsed.seed;
  count = parsed.count;
  if (typeof parsed.state === "string" && /^[0-9a-fA-F]{1,16}$/.test(parsed.state)) {
    state = BigInt("0x" + parsed.state);
  } else {
    state = seedToState(seed);
    for (let i = 0; i < count; i++) state = mix(state).state;
  }
  flushedCount = count;
  ensureExitHook();
}

/**
 * Persist the cursor and append this tick's rolls. No-ops when nothing rolled
 * or the server has not called loadGameRoll (unit tests).
 */
export function flushGameRoll(): void {
  if (!dataDir) return;
  if (count === flushedCount && pending.length === 0) return;
  // Cursor first: a crash after this cannot repeat the sequence.
  if (count !== flushedCount) {
    durableWrite(join(dataDir, CURSOR_NAME), cursorText());
    flushedCount = count;
  }
  if (pending.length === 0) return;
  const payload = Buffer.from(pending.map((row) => JSON.stringify(row) + "\n").join(""), "utf8");
  const fd = openSync(join(dataDir, TAPE_NAME), "a");
  try {
    let off = 0;
    while (off < payload.length) {
      const wrote = writeSync(fd, payload, off, payload.length - off);
      if (wrote <= 0) throw new Error("game-roll tape stalled");
      off += wrote;
    }
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  pending = [];
}

/** Drop disk binding and restart the sequence. Unit tests only. */
export function resetGameRollForTests(nextSeed = "test"): void {
  dataDir = null;
  seed = nextSeed;
  state = seedToState(nextSeed);
  count = 0;
  flushedCount = 0;
  pending = [];
  scripted.length = 0;
}

/** Next rollUnit calls return these values and do not advance the saved sequence. */
export function scriptNextRollsForTests(units: number[]): void {
  for (const unit of units) {
    if (!Number.isFinite(unit) || unit < 0 || unit >= 1) {
      throw new Error("scripted roll must be in [0, 1)");
    }
    scripted.push(unit);
  }
}

export function gameRollCount(): number {
  return count;
}

/** Uniform value in [0, 1). */
export function rollUnit(tag: string): number {
  if (scripted.length > 0) return scripted.shift()!;
  const mixed = mix(state);
  state = mixed.state;
  count += 1;
  pending.push({ n: count, tag, z: mixed.z.toString(16).padStart(16, "0") });
  return unitFromZ(mixed.z);
}

/** Integer in [0, n). Empty and singleton ranges do not consume a roll. */
export function rollIndex(tag: string, n: number): number {
  if (!Number.isInteger(n) || n <= 1) return 0;
  return Math.floor(rollUnit(tag) * n);
}

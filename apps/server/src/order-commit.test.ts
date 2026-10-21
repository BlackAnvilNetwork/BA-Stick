/**
 * The real lok-order binary commits the batch the server submits.
 *
 * startProcessOrderer writes one JSON line and returns without the commit.
 * This test writes that same line to the binary, then reads the last status
 * line. Three allowlisted validators print a status line, not a separate
 * commit object. submitOnSimTick still returns without that status.
 */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { orderSubmitLine, startProcessOrderer, submitOnSimTick } from "./order-submit";

const CRATE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../contracts/lok-order");
const GNU_HOST = "stable-x86_64-pc-windows-gnu";
const GNU_TARGET = "x86_64-pc-windows-gnu";

type CommitLine = {
  committed: true;
  height: number;
  root: string;
  signatures: number;
};

/** Windows must link with the GNU host. Other hosts use stable, not the engine's 1.83 pin. */
function prepareCargo(cargoArgs: string[]): void {
  if (process.platform === "win32") {
    const host = spawnSync("rustup", ["run", GNU_HOST, "rustc", "-vV"], {
      cwd: tmpdir(),
      encoding: "utf8",
    });
    assert.equal(host.status, 0, host.stderr);
    assert.match(host.stdout, /^host: x86_64-pc-windows-gnu$/m);
    cargoArgs.unshift("+" + GNU_HOST);
    cargoArgs.push("--target", GNU_TARGET);
    return;
  }
  const listed = spawnSync("rustup", ["toolchain", "list"], { encoding: "utf8" });
  assert.equal(listed.status, 0, listed.stderr);
  if (!/^stable(-|\s|$)/m.test(listed.stdout)) {
    const installed = spawnSync("rustup", ["toolchain", "install", "stable", "--profile", "minimal"], {
      encoding: "utf8",
      timeout: 10 * 60 * 1000,
      maxBuffer: 16 * 1024 * 1024,
    });
    assert.equal(installed.status, 0, `${installed.stdout ?? ""}\n${installed.stderr ?? ""}`.slice(-4000));
  }
  cargoArgs.unshift("+stable");
}

function buildLokOrder(): string {
  const cargoArgs = ["build", "--bin", "lok-order", "--locked"];
  prepareCargo(cargoArgs);

  const built = spawnSync("cargo", cargoArgs, {
    cwd: CRATE,
    encoding: "utf8",
    timeout: 20 * 60 * 1000,
    maxBuffer: 64 * 1024 * 1024,
  });
  const log = `${built.stdout ?? ""}\n${built.stderr ?? ""}`;
  assert.equal(built.status, 0, log.slice(-4000));
  if (process.platform === "win32") {
    assert.equal(/\blink\.exe\b/i.test(log), false);
  }

  const exe =
    process.platform === "win32"
      ? path.join(CRATE, "target", GNU_TARGET, "debug", "lok-order.exe")
      : path.join(CRATE, "target", "debug", "lok-order");
  assert.equal(existsSync(exe), true, exe);
  return exe;
}

function parseCommit(text: string, stderr: string): CommitLine {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (err) {
    throw new Error(`commit line ${JSON.stringify(text)} stderr ${stderr} (${String(err)})`);
  }
  assert.ok(value && typeof value === "object", stderr);
  const row = value as Record<string, unknown>;
  assert.equal(row.committed, true);
  assert.equal(typeof row.height, "number");
  assert.equal(typeof row.root, "string");
  assert.equal(typeof row.signatures, "number");
  return {
    committed: true,
    height: row.height as number,
    root: row.root as string,
    signatures: row.signatures as number,
  };
}

/** Write one submit line. Snapshot stdout before yielding, then read the commit. */
async function commitSubmittedLine(bin: string, line: string): Promise<CommitLine> {
  const child = spawn(bin, [], {
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
  if (!child.stdin || !child.stdout || !child.stderr) throw new Error("lok-order pipes");
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });
  child.stdin.on("error", () => {});
  child.on("error", () => {});

  const finished = once(child, "exit");
  child.stdin.write(line);
  child.stdin.end();
  const timer = setTimeout(() => child.kill(), 30_000);
  const [code] = await finished;
  clearTimeout(timer);
  assert.equal(code, 0, stderr);
  const lines = stdout
    .split("\n")
    .map((row) => row.trim())
    .filter((row) => row.length > 0);
  assert.ok(lines.length >= 1, stderr);
  return parseCommit(lines[lines.length - 1]!, stderr);
}

test("one validator commits the batch the server submits", { timeout: 20 * 60 * 1000 }, async () => {
  const bin = buildLokOrder();
  const height = 6;
  const nextRoot = new Uint8Array(32);
  for (let i = 0; i < nextRoot.length; i += 1) nextRoot[i] = (0x10 + i * 13) & 0xff;
  const line = orderSubmitLine(height, nextRoot);
  assert.equal(line, `{"height":${height},"root":"${Buffer.from(nextRoot).toString("hex")}"}\n`);
  assert.match(line, /^\{"height":6,"root":"[0-9a-f]{64}"\}\n$/);

  const absent = submitOnSimTick(null, { ok: true, height, nextRoot });
  assert.equal(absent.tickFailed, false);
  assert.equal(absent.status, "provisional");

  const orderer = startProcessOrderer(bin);
  assert.ok(orderer);
  const tick = submitOnSimTick(orderer, { ok: true, height, nextRoot });
  assert.equal(tick.tickFailed, false);
  assert.equal(tick.status, "submitted");
  await orderer.stop();

  const commit = await commitSubmittedLine(bin, line);
  assert.equal(commit.height, height);
  assert.equal(commit.root, Buffer.from(nextRoot).toString("hex"));
  assert.ok(commit.signatures >= 2);
});

/**
 * The live tick calls `executeOnSimTick` and returns before SP1 finishes.
 * `LOK_SP1_LIVE=1` also runs the real executor: SP1 replays the engine crate,
 * the committed state root matches keccak `commit_map`, and RISC Zero is refused.
 * That run does not pin a verifying key and does not reject a batch.
 */
import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { keccak256 } from "viem";
import { executeOnSimTick, sp1ExecuteLine, startSp1Process, type Sp1Executor } from "./sp1-execute";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const INDEX = path.join(HERE, "index.ts");
const ENGINE = path.resolve(HERE, "../../../contracts/lok-log/engine");
const LOK_LOG = path.resolve(HERE, "../../../contracts/lok-log");
const GNU_HOST = "1.83.0-x86_64-pc-windows-gnu";
const GNU_TARGET = "x86_64-pc-windows-gnu";
const EMPTY_LOG = '{"type":"characters","characters":[]}';

function dockerBin(): string {
  if (process.env.DOCKER) return process.env.DOCKER;
  if (process.platform === "win32") {
    return "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe";
  }
  return "docker";
}

test("the server asks SP1 to execute and does not name another prover", () => {
  const line = sp1ExecuteLine(EMPTY_LOG);
  const job = JSON.parse(line.trim()) as { prover: string; log: string };
  assert.equal(job.prover, "sp1");
  assert.equal(job.log, EMPTY_LOG);
  assert.equal(line.endsWith("\n"), true);
  assert.equal(line.toLowerCase().includes("risc"), false);
  assert.equal(line.toLowerCase().includes("poseidon"), false);
});

test("tickSim calls SP1 on the live path", () => {
  const indexSrc = readFileSync(INDEX, "utf8");
  assert.match(indexSrc, /loadSp1Executor\(/);
  assert.match(indexSrc, /const tickSp1 = loadSp1Executor\(\)/);
  assert.match(indexSrc, /executeOnSimTick\(\s*tickSp1,\s*\(\)\s*=>\s*lok\.logDocument\(\)\s*\)/);
  assert.equal(indexSrc.includes("LOCAL_RULESET_WASM_SHA256"), false);
});

test("a missing executor returns without waiting and without reading the log", () => {
  let read = false;
  const started = Date.now();
  const result = executeOnSimTick(null, () => {
    read = true;
    return EMPTY_LOG;
  });
  assert.equal(result.tickFailed, false);
  assert.equal(read, false);
  assert.ok(Date.now() - started < 50);
});

test("the tick returns before SP1 serializes the log or finishes", async () => {
  const executor = startSp1Process(process.execPath, [
    "-e",
    "let b='';process.stdin.on('data',c=>{b+=c});setTimeout(()=>{process.stdout.write(b);process.exit(0)},400);",
  ]);
  assert.ok(executor);
  let read = false;
  let second = false;
  const started = Date.now();
  const result = executeOnSimTick(executor, () => {
    read = true;
    return EMPTY_LOG;
  });
  assert.equal(result.tickFailed, false);
  assert.equal(read, false);
  assert.equal(executor.busy(), true);
  assert.ok(Date.now() - started < 50);

  const again = executeOnSimTick(executor, () => {
    second = true;
    return EMPTY_LOG;
  });
  assert.equal(again.tickFailed, false);
  assert.equal(second, false);

  const line = await waitForResult(executor, 2_000);
  assert.equal(read, true);
  assert.equal(second, false);
  const job = JSON.parse(line) as { prover: string; log: string };
  assert.equal(job.prover, "sp1");
  assert.equal(job.log, EMPTY_LOG);
  await executor.stop();
});

test(
  "SP1 executes the engine crate and keccak stays the state root",
  { timeout: 60 * 60 * 1000, skip: process.env.LOK_SP1_LIVE !== "1" },
  async () => {
    const docker = dockerBin();
    const image = spawnSync(docker, ["image", "inspect", "lok-sp1-execute"], { encoding: "utf8" });
    if (image.status !== 0) {
      const built = spawnSync(docker, ["build", "-t", "lok-sp1-execute", "-f", "sp1/Dockerfile", "."], {
        cwd: LOK_LOG,
        encoding: "utf8",
        timeout: 50 * 60 * 1000,
        maxBuffer: 64 * 1024 * 1024,
      });
      assert.equal(built.status, 0, `${built.stdout ?? ""}\n${built.stderr ?? ""}`.slice(-4000));
    }

    const spawnLog = engineDocument();
    const expectedSpawn = replayRoot(spawnLog);
    const expectedEmpty = keccak256(new Uint8Array(0));

    const executor = startSp1Process(docker, ["run", "--rm", "-i", "--network", "none", "lok-sp1-execute"]);
    assert.ok(executor);
    const emptyTick = executeOnSimTick(executor, () => EMPTY_LOG);
    assert.equal(emptyTick.tickFailed, false);
    const empty = parseResult(await waitForResult(executor, 10 * 60 * 1000), executor.stderr());
    assert.equal(empty.keccakPrecompile, true);
    assert.deepEqual(empty.stateRoots, [expectedEmpty]);

    const spawnTick = executeOnSimTick(executor, () => spawnLog);
    assert.equal(spawnTick.tickFailed, false);
    const spawned = parseResult(await waitForResult(executor, 10 * 60 * 1000), executor.stderr());
    assert.equal(spawned.keccakPrecompile, true);
    assert.deepEqual(spawned.stateRoots, [expectedSpawn]);
    await executor.stop();

    const refusal = await runJob(docker, { prover: "risc0", log: EMPTY_LOG });
    assert.equal(refusal.ok, false);
    assert.equal(refusal.prover, "RISC Zero");
    assert.match(String(refusal.error), /not accepted on this genesis/);
    assert.equal(refusal.stateRoots, undefined);
  },
);

async function waitForResult(executor: Sp1Executor, timeoutMs: number): Promise<string> {
  const previous = executor.lastResult();
  const started = Date.now();
  for (;;) {
    const line = executor.lastResult();
    if (line && line !== previous && !executor.busy()) return line;
    if (Date.now() - started > timeoutMs) {
      throw new Error(`no SP1 result\n${executor.stderr()}\nlast=${line ?? ""}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

function parseResult(line: string, stderr: string): {
  ok: true;
  prover: "sp1";
  stateRoots: string[];
  keccakPrecompile: boolean;
} {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch (err) {
    throw new Error(`result ${JSON.stringify(line)} stderr ${stderr} (${String(err)})`);
  }
  assert.ok(value && typeof value === "object", stderr);
  const row = value as Record<string, unknown>;
  assert.equal(row.ok, true, `${line}\n${stderr}`);
  assert.equal(row.prover, "sp1");
  assert.equal(row.keccakPrecompile, true, `${line}\n${stderr}`);
  assert.ok(Array.isArray(row.stateRoots), stderr);
  assert.equal("verifyingKey" in row, false);
  return {
    ok: true,
    prover: "sp1",
    stateRoots: row.stateRoots as string[],
    keccakPrecompile: true,
  };
}

function engineDocument(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "lok-sp1-fixture-"));
  mkdirSync(path.join(dir, "src"));
  const enginePath = ENGINE.replace(/\\/g, "/");
  writeFileSync(
    path.join(dir, "Cargo.toml"),
    `[package]\nname = "lok-sp1-fixture"\nversion = "0.1.0"\nedition = "2021"\npublish = false\n\n[dependencies]\nlok-engine = { path = ${JSON.stringify(enginePath)} }\n`,
  );
  writeFileSync(
    path.join(dir, "src", "main.rs"),
    `fn main() {
    let mut gate = lok_engine::Gate::open("").expect("open");
    let applied = gate.apply_command(r#"{"op":"spawn","tokenId":"1","startingJob":3}"#);
    if !applied.contains("\\"ok\\":true") { panic!("{applied}"); }
    print!("{}", gate.document_json());
}
`,
  );
  const cargoArgs = ["run", "--quiet"];
  if (process.platform === "win32") {
    cargoArgs.unshift("+" + GNU_HOST);
    cargoArgs.push("--target", GNU_TARGET);
  }
  const ran = spawnSync("cargo", cargoArgs, {
    cwd: dir,
    encoding: "utf8",
    timeout: 20 * 60 * 1000,
    maxBuffer: 32 * 1024 * 1024,
  });
  const log = `${ran.stdout ?? ""}\n${ran.stderr ?? ""}`;
  assert.equal(ran.status, 0, log.slice(-4000));
  if (process.platform === "win32") assert.equal(/\blink\.exe\b/i.test(log), false);
  return ran.stdout;
}

function replayRoot(log: string): string {
  const cargoArgs = ["build", "--bin", "lok-replay"];
  if (process.platform === "win32") {
    cargoArgs.unshift("+" + GNU_HOST);
    cargoArgs.push("--target", GNU_TARGET);
  }
  const built = spawnSync("cargo", cargoArgs, {
    cwd: ENGINE,
    encoding: "utf8",
    timeout: 20 * 60 * 1000,
    maxBuffer: 32 * 1024 * 1024,
  });
  const buildLog = `${built.stdout ?? ""}\n${built.stderr ?? ""}`;
  assert.equal(built.status, 0, buildLog.slice(-4000));
  if (process.platform === "win32") assert.equal(/\blink\.exe\b/i.test(buildLog), false);
  const exe =
    process.platform === "win32"
      ? path.join(ENGINE, "target", GNU_TARGET, "debug", "lok-replay.exe")
      : path.join(ENGINE, "target", "debug", "lok-replay");
  const dir = mkdtempSync(path.join(tmpdir(), "lok-sp1-replay-"));
  const file = path.join(dir, "log.json");
  writeFileSync(file, log);
  const ran = spawnSync(exe, [file], { encoding: "utf8" });
  assert.equal(ran.status, 0, `${ran.stdout ?? ""}\n${ran.stderr ?? ""}`);
  const roots = [...ran.stdout.matchAll(/state_root=(0x[0-9a-f]{64})/g)].map((match) => match[1]!);
  assert.equal(roots.length, 1, ran.stdout);
  return roots[0]!;
}

function runJob(docker: string, job: { prover: string; log: string }): Promise<Record<string, unknown>> {
  const child = spawn(docker, ["run", "--rm", "-i", "--network", "none", "lok-sp1-execute"], {
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
    env: { ...process.env, SP1_PROVER: "cpu" },
  });
  return readJson(child, JSON.stringify(job) + "\n");
}

function readJson(child: ChildProcess, line: string): Promise<Record<string, unknown>> {
  if (!child.stdin || !child.stdout || !child.stderr) return Promise.reject(new Error("docker pipes"));
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
  child.stdin.write(line);
  child.stdin.end();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`docker timed out\n${stderr}\n${stdout}`));
    }, 10 * 60 * 1000);
    child.on("exit", () => {
      clearTimeout(timer);
      const jsonLine = stdout
        .split("\n")
        .map((row) => row.trim())
        .filter((row) => row.startsWith("{"))
        .at(-1);
      if (!jsonLine) {
        reject(new Error(`no json\n${stderr}\n${stdout}`));
        return;
      }
      resolve(JSON.parse(jsonLine) as Record<string, unknown>);
    });
  });
}

/**
 * Hand the live engine log to SP1 without waiting for execution.
 *
 * `LOK_SP1_BIN`, when set, is the `lok-sp1-execute` process. That process runs
 * the `lok-engine` crate inside SP1 and commits `commit_map` (keccak). RISC Zero
 * is not a prover this process will run. This module does not pin a verifying
 * key. A finished line that carries a verifying key is a proof the tick can
 * take without waiting. Comparing that proof to wasm replay, and rejecting
 * the batch, happens in the seal. A line with no proof does not reject a
 * batch. This module does not broadcast to Gnosis or Chiado.
 *
 * The 20 Hz tick calls `executeOnSimTick` and returns. Serializing the log and
 * the SP1 execution both happen after that return. A missing binary, or an
 * execution that has not finished, leaves play on the same path.
 */
import { spawn, type ChildProcess } from "node:child_process";

export type Sp1ExecuteResult = { tickFailed: false };

/** One SP1 proof the executor has already printed. Absent until that line arrives. */
export type ArrivedSp1Proof = {
  prover: string;
  verifyingKey: string;
  result: Uint8Array;
  log: Uint8Array;
};

export type Sp1Executor = {
  /** True from the moment a log is queued until SP1 prints a result line. */
  busy(): boolean;
  /**
   * Queue one execution of `log()`. Returns before the log is serialized and
   * before SP1 finishes. A second call while busy does not write another line.
   */
  begin(log: () => string): void;
  /** Last stdout line, if the process has printed one. */
  lastResult(): string | null;
  /**
   * The proof from the last finished line, then clears it.
   * Null when that line carried no proof. This does not wait.
   */
  takeProof(): ArrivedSp1Proof | null;
  stderr(): string;
  stop(): Promise<void>;
};

/**
 * Proof the executor has already printed, or null.
 * A missing executor has not answered. This does not wait and does not spawn.
 */
export function takeArrivedSp1Proof(executor: Sp1Executor | null | undefined): ArrivedSp1Proof | null {
  if (!executor) return null;
  return executor.takeProof();
}

/**
 * One stdin line for `lok-sp1-execute`. The prover is SP1. The log is the
 * engine document the guest replays.
 */
export function sp1ExecuteLine(log: string): string {
  return JSON.stringify({ prover: "sp1", log }) + "\n";
}

/**
 * What `tickSim` calls every tick.
 * Always returns. Does not read the execution result and does not throw.
 */
export function executeOnSimTick(
  executor: Sp1Executor | null | undefined,
  log: () => string,
): Sp1ExecuteResult {
  if (executor && !executor.busy()) executor.begin(log);
  return { tickFailed: false };
}

/** Start `lok-sp1-execute` when `LOK_SP1_BIN` names it. Otherwise SP1 is absent. */
export function loadSp1Executor(env: NodeJS.ProcessEnv = process.env): Sp1Executor | null {
  const bin = env.LOK_SP1_BIN;
  if (!bin) return null;
  return startSp1Process(bin);
}

/** Spawn the executor. A binary that cannot start is absent, not fatal. */
export function startSp1Process(bin: string, args: readonly string[] = []): Sp1Executor | null {
  let child: ChildProcess;
  try {
    child = spawn(bin, args, {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      env: {
        ...process.env,
        SP1_PROVER: "cpu",
      },
    });
  } catch (err) {
    console.error("[sp1] executor absent", err);
    return null;
  }
  return executorFromChild(child);
}

function executorFromChild(child: ChildProcess): Sp1Executor {
  let failed = false;
  let busy = false;
  let lastResult: string | null = null;
  let inflightLog: string | null = null;
  let arrived: ArrivedSp1Proof | null = null;
  let stderrTail = "";
  let stdoutBuf = "";
  child.stdout?.setEncoding("utf8");
  child.stderr?.setEncoding("utf8");
  child.stdout?.on("data", (chunk: string) => {
    stdoutBuf += chunk;
    let nl = stdoutBuf.indexOf("\n");
    while (nl >= 0) {
      const line = stdoutBuf.slice(0, nl).trim();
      stdoutBuf = stdoutBuf.slice(nl + 1);
      nl = stdoutBuf.indexOf("\n");
      if (!line) continue;
      if (line.startsWith("{")) {
        lastResult = line;
        const proof = parseArrivedProof(line, inflightLog);
        inflightLog = null;
        if (proof) arrived = proof;
        busy = false;
      } else {
        stderrTail = (stderrTail + line + "\n").slice(-4000);
      }
    }
  });
  child.stderr?.on("data", (chunk: string) => {
    stderrTail = (stderrTail + chunk).slice(-4000);
  });
  child.on("error", (err) => {
    failed = true;
    busy = false;
    console.error("[sp1] executor absent", err);
  });
  child.stdin?.on("error", () => {
    failed = true;
    busy = false;
  });
  child.on("exit", () => {
    failed = true;
    busy = false;
  });

  function write(line: string): boolean {
    const stdin = child.stdin;
    if (failed || child.exitCode != null || !stdin || stdin.destroyed || !stdin.writable) {
      busy = false;
      return false;
    }
    // A full buffer still queued the line. Do not wait for the drain or the result.
    stdin.write(line);
    return true;
  }

  return {
    busy: () => busy,
    begin(log: () => string) {
      busy = true;
      setImmediate(() => {
        try {
          const text = log();
          inflightLog = text;
          if (!write(sp1ExecuteLine(text))) {
            inflightLog = null;
            busy = false;
          }
        } catch (err) {
          inflightLog = null;
          busy = false;
          console.error("[sp1] execute skipped", err);
        }
      });
    },
    lastResult: () => lastResult,
    takeProof() {
      const found = arrived;
      arrived = null;
      return found;
    },
    stderr: () => stderrTail,
    stop() {
      failed = true;
      busy = false;
      if (child.exitCode != null || child.signalCode != null) return Promise.resolve();
      return new Promise((resolve) => {
        child.once("exit", () => resolve());
        child.kill();
      });
    },
  };
}

/**
 * A proof line names a verifying key and a 32-byte result.
 * Execution output that only lists state roots is not a proof.
 */
function parseArrivedProof(line: string, log: string | null): ArrivedSp1Proof | null {
  if (log == null) return null;
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (!("verifyingKey" in row) && !("result" in row) && !("proofResult" in row)) return null;
  const raw = typeof row.result === "string" ? row.result : typeof row.proofResult === "string" ? row.proofResult : "";
  return {
    prover: typeof row.prover === "string" ? row.prover : "",
    verifyingKey: typeof row.verifyingKey === "string" ? row.verifyingKey : "",
    result: decodeProofResult(raw),
    log: new TextEncoder().encode(log),
  };
}

function decodeProofResult(hex: string): Uint8Array {
  const body = hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
  if (!/^[0-9a-fA-F]{64}$/.test(body)) return new Uint8Array();
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) out[i] = Number.parseInt(body.slice(i * 2, i * 2 + 2), 16);
  return out;
}

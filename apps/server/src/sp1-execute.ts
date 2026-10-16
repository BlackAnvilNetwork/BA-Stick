/**
 * Hand the live engine log to SP1 without waiting for execution.
 *
 * `LOK_SP1_BIN`, when set, is the `lok-sp1-execute` process. That process runs
 * the `lok-engine` crate inside SP1 and commits `commit_map` (keccak). RISC Zero
 * is not a prover this process will run. This module does not pin a verifying
 * key, does not compare the execution to wasm replay, and does not reject a
 * batch. It does not broadcast to Gnosis or Chiado.
 *
 * The 20 Hz tick calls `executeOnSimTick` and returns. Serializing the log and
 * the SP1 execution both happen after that return. A missing binary, or an
 * execution that has not finished, leaves play on the same path.
 */
import { spawn, type ChildProcess } from "node:child_process";

export type Sp1ExecuteResult = { tickFailed: false };

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
  stderr(): string;
  stop(): Promise<void>;
};

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
          if (!write(sp1ExecuteLine(log()))) busy = false;
        } catch (err) {
          busy = false;
          console.error("[sp1] execute skipped", err);
        }
      });
    },
    lastResult: () => lastResult,
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

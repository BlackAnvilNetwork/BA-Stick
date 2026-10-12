/**
 * Shared throwaway-anvil helpers for support e2e tests.
 * Does not touch the shared :8545 anvil.
 */
import { spawn, type ChildProcess, execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const SUPPORT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
export const SUPPORT_LOK = join(SUPPORT_ROOT, "contracts", "lok-log");
export const SUPPORT_ANVIL_K0 =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;

export function resolveAnvilBin(): string | null {
  for (const candidate of [
    process.env.ANVIL_PATH,
    "anvil",
    join(process.env.HOME || "", ".foundry/bin/anvil"),
    "/home/ubuntu/.foundry/bin/anvil",
  ]) {
    if (!candidate) continue;
    try {
      if (candidate === "anvil") {
        execFileSync("anvil", ["--version"], { stdio: "ignore" });
        return "anvil";
      }
      if (existsSync(candidate)) return candidate;
    } catch {
      /* try next */
    }
  }
  return null;
}

export function forgeLibsPresent(lokDir: string = SUPPORT_LOK): boolean {
  return (
    existsSync(join(lokDir, "lib", "forge-std")) &&
    existsSync(join(lokDir, "foundry.toml"))
  );
}

export function resolveForgeBin(): string | null {
  for (const candidate of [
    process.env.FORGE_PATH,
    "forge",
    join(process.env.HOME || "", ".foundry/bin/forge"),
    "/home/ubuntu/.foundry/bin/forge",
  ]) {
    if (!candidate) continue;
    try {
      if (candidate === "forge") {
        execFileSync("forge", ["--version"], { stdio: "ignore" });
        return "forge";
      }
      if (existsSync(candidate)) return candidate;
    } catch {
      /* try next */
    }
  }
  return null;
}

export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => {
      const addr = s.address();
      if (!addr || typeof addr === "string") {
        s.close();
        reject(new Error("no port"));
        return;
      }
      const port = addr.port;
      s.close(() => resolve(port));
    });
  });
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function waitRpc(rpc: string, tries = 40): Promise<void> {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
      });
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await sleep(250);
  }
  throw new Error("anvil did not start");
}

export type ThrowawayAnvil = {
  rpc: string;
  proc: ChildProcess;
  stop: () => void;
};

export async function startThrowawayAnvil(): Promise<ThrowawayAnvil> {
  const bin = resolveAnvilBin();
  if (!bin) throw new Error("anvil not found");
  const port = await freePort();
  const rpc = "http://127.0.0.1:" + port;
  const proc = spawn(bin, ["--port", String(port), "--chain-id", "31337"], {
    stdio: ["ignore", "ignore", "pipe"],
  });
  await waitRpc(rpc);
  return {
    rpc,
    proc,
    stop: () => {
      proc.kill("SIGTERM");
    },
  };
}

/** Deploy AhEscrow with deployer (= key 0) holding LISTING_ROLE. */
export function deployAhEscrowFixture(rpc: string): string {
  const forge = resolveForgeBin();
  if (!forge) throw new Error("forge not found");
  if (!forgeLibsPresent()) throw new Error("contracts/lok-log/lib missing");
  const out = execFileSync(
    forge,
    [
      "script",
      "script/AhEscrowFixture.s.sol:AhEscrowFixture",
      "--rpc-url",
      rpc,
      "--private-key",
      SUPPORT_ANVIL_K0,
      "--broadcast",
      "-vv",
    ],
    {
      cwd: SUPPORT_LOK,
      encoding: "utf8",
      env: { ...process.env, FOUNDRY_DISABLE_NIGHTLY_WARNING: "1" },
    },
  );
  const m = /ESCROW\s+(0x[a-fA-F0-9]{40})/.exec(out);
  if (!m) throw new Error("AhEscrowFixture did not print ESCROW\n" + out.slice(-800));
  return m[1]!;
}

export const supportAnvilAvailable = !!(
  resolveAnvilBin() &&
  resolveForgeBin() &&
  forgeLibsPresent()
);

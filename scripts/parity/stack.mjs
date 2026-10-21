// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Local-only stack for the parity harness: throwaway anvil (chain 31337 only),
// MintFixture + AhEscrow + PvpBounty, and the real apps/server on a free port.
// Never points at Gnosis/Chiado. Keys come from anvil's --config-out file and are never printed.
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir, homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const LOK = join(ROOT, "contracts", "lok-log");
const SERVER = join(ROOT, "apps", "server");
export const requireServer = createRequire(join(SERVER, "package.json"));

const bin = (n) => {
  const p = join(homedir(), ".foundry", "bin", n);
  return existsSync(p) ? p : n;
};

export function freePort() {
  return new Promise((res, rej) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => res(port));
    });
    s.on("error", rej);
  });
}

async function rpc(url, method, params = []) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  return j.result;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function forge(args, rpcUrl) {
  return execFileSync(bin("forge"), args, { cwd: LOK, encoding: "utf8", env: { ...process.env, ETH_RPC_URL: rpcUrl } });
}

export async function startStack({ log = () => {} } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "ba-parity-"));
  const procs = [];
  const anvilPort = await freePort();
  const rpcUrl = `http://127.0.0.1:${anvilPort}`;
  const cfgOut = join(dir, "anvil.json");
  const anvil = spawn(bin("anvil"), ["--silent", "--port", String(anvilPort), "--chain-id", "31337", "--config-out", cfgOut], {
    stdio: "ignore",
  });
  procs.push(anvil);
  for (let i = 0; i < 100; i++) {
    try { await rpc(rpcUrl, "eth_chainId"); break; } catch { await sleep(100); }
  }
  const chainId = Number(await rpc(rpcUrl, "eth_chainId"));
  if (chainId !== 31337) throw new Error(`refusing: ${rpcUrl} is chain ${chainId}, not anvil 31337`);
  for (let i = 0; i < 50 && !existsSync(cfgOut); i++) await sleep(100);
  const cfg = JSON.parse(readFileSync(cfgOut, "utf8"));
  const accounts = cfg.available_accounts;
  const keys = cfg.private_keys; // anvil's public test keys; held in memory, never printed
  const deployer = accounts[0];
  const treasury = accounts[9];

  if (!existsSync(join(LOK, "lib", "forge-std"))) throw new Error("contracts/lok-log/lib missing (forge install)");
  log("deploy MintFixture");
  const out = forge(["script", "script/MintFixture.s.sol", "--rpc-url", rpcUrl, "--broadcast", "--unlocked", "--sender", deployer], rpcUrl);
  const pick = (re) => (out.match(re) || [])[1];
  const NFT = pick(/\bNFT\s+(0x[0-9a-fA-F]{40})/);
  const FACTORY = pick(/\bFACTORY\s+(0x[0-9a-fA-F]{40})/);
  if (!NFT || !FACTORY) throw new Error("MintFixture output missing NFT/FACTORY");
  const create = (contract, args) => {
    const o = forge(["create", contract, "--rpc-url", rpcUrl, "--broadcast", "--unlocked", "--from", deployer, "--constructor-args", ...args], rpcUrl);
    const a = (o.match(/Deployed to:\s+(0x[0-9a-fA-F]{40})/) || [])[1];
    if (!a) throw new Error("forge create failed for " + contract + "\n" + o);
    return a;
  };
  log("deploy AhEscrow + PvpBounty against the fixture CharacterNFT");
  const ESCROW = create("src/AhEscrow.sol:AhEscrow", [deployer, NFT, treasury]);
  const PVP = create("src/PvpBounty.sol:PvpBounty", [NFT, deployer, deployer, "0"]);
  const castCall = (to, sig) => execFileSync(bin("cast"), ["call", to, sig, "--rpc-url", rpcUrl], { encoding: "utf8" }).trim();
  const CHECKPOINT = castCall(FACTORY, "state()(address)");

  const port = await freePort();
  const clockFile = join(dir, "clock-offset");
  writeFileSync(clockFile, "0");
  const dataDir = join(dir, "data");
  const env = {
    ...process.env,
    PORT: String(port),
    NETWORK: "anvil",
    LOK_REPLICA: "1",
    LOK_DATA_DIR: dataDir,
    LOK_CHAIN_ID: "31337",
    LOK_CHAIN_RPC: rpcUrl,
    LOK_NFT: NFT,
    LOK_FACTORY: FACTORY,
    LOK_CHECKPOINT: CHECKPOINT,
    LOK_AH_ESCROW: ESCROW,
    LOK_PVP_BOUNTY: PVP,
    LOK_OWNER_KEY: keys[0],
    ALLOW_DEBUG_CHEATS: "1",
    PARITY_CLOCK_FILE: clockFile,
  };
  delete env.LOK_PVP_SYNTHETIC;
  const serverLog = join(dir, "server.log");
  const { openSync } = await import("node:fs");
  const fd = openSync(serverLog, "a");
  const startServer = () => {
    const srv = spawn(
      process.execPath,
      ["--import", "tsx", "--import", join(ROOT, "scripts", "parity", "clock-preload.mjs"), "src/index.ts"],
      { cwd: SERVER, env, stdio: ["ignore", fd, fd] },
    );
    procs.push(srv);
    return srv;
  };
  log("start apps/server");
  let server = startServer();
  const waitListening = async () => {
    for (let i = 0; i < 600; i++) {
      if (readFileSync(serverLog, "utf8").includes("listening") || (await portOpen(port))) return;
      await sleep(200);
    }
    throw new Error("server did not start; see " + serverLog);
  };
  await waitListening();
  let clockMs = 0;
  return {
    dir, rpcUrl, port, wsUrl: `ws://127.0.0.1:${port}`, chainId,
    accounts, keys, contracts: { NFT, FACTORY, ESCROW, PVP, CHECKPOINT }, serverLog, treasury,
    rpc: (m, p) => rpc(rpcUrl, m, p),
    async advanceClock(ms) {
      clockMs += ms;
      writeFileSync(clockFile, String(clockMs));
      server.kill("SIGUSR2");
      await sleep(100);
    },
    stop() { for (const p of procs) try { p.kill("SIGTERM"); } catch {} },
  };
}

function portOpen(port) {
  return new Promise((res) => {
    import("node:net").then(({ connect }) => {
      const s = connect(port, "127.0.0.1");
      s.on("connect", () => { s.destroy(); res(true); });
      s.on("error", () => res(false));
    });
  });
}

#!/usr/bin/env node
// Rebuild the engine wasm and compare it with the checked-in bundle and the ruleset pin.
//
//   node contracts/lok-log/engine/scripts/check-wasm-pin.mjs            rebuild, then compare
//   node contracts/lok-log/engine/scripts/check-wasm-pin.mjs --no-build compare pkg/ with the pin only
//   node contracts/lok-log/engine/scripts/check-wasm-pin.mjs --install  rebuild, copy into pkg/, print the new pin
//
// Exit 0 when pkg/lok_engine.wasm matches LOCAL_RULESET_WASM_SHA256 in apps/server/src/lok-vault.ts
// (and, unless --no-build, the fresh build matches pkg/). Exit 1 on any mismatch.
//
// Rebuilds remap host/cargo paths (--remap-path-prefix) for cross-machine
// comparison. A remapped digest that differs from pkg/ is expected until the
// batched redeploy commits a new pkg + LOCAL_RULESET_WASM_SHA256. CI hard-gates
// with --no-build (pkg ↔ pin only).
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const engine = join(dirname(fileURLToPath(import.meta.url)), "..");
const repo = join(engine, "..", "..", "..");
const pkg = join(engine, "pkg", "lok_engine.wasm");
const built = join(engine, "target", "wasm32-unknown-unknown", "release", "lok_engine.wasm");
const vault = join(repo, "apps", "server", "src", "lok-vault.ts");

const sha = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const args = new Set(process.argv.slice(2));
const pin = /LOCAL_RULESET_WASM_SHA256\s*=\s*"([0-9a-f]{64})"/.exec(readFileSync(vault, "utf8"))?.[1];
let ok = true;

function abs(path) {
  try {
    return existsSync(path) ? realpathSync(path) : path;
  } catch {
    return path;
  }
}

/** Remap absolute prefixes so panic paths do not embed the checkout / cargo home. */
function rustflagsForRepro() {
  const flags = [];
  const engineAbs = abs(engine).replace(/\\/g, "/");
  const repoAbs = abs(repo).replace(/\\/g, "/");
  const cargoHome = abs(process.env.CARGO_HOME || join(homedir(), ".cargo")).replace(/\\/g, "/");
  const rustupHome = abs(process.env.RUSTUP_HOME || join(homedir(), ".rustup")).replace(/\\/g, "/");
  // Longest prefixes first.
  for (const [from, to] of [
    [engineAbs, "/engine"],
    [repoAbs, "/repo"],
    [cargoHome, "/cargo"],
    [rustupHome, "/rustup"],
  ]) {
    if (from && from.length > 1) flags.push(`--remap-path-prefix=${from}=${to}`);
    // Also map with trailing slash variants cargo sometimes emits.
    if (from && !from.endsWith("/")) flags.push(`--remap-path-prefix=${from}/=${to}/`);
  }
  return flags.join(" ");
}

if (!args.has("--no-build")) {
  const remapped = rustflagsForRepro();
  console.log("remap  " + remapped);
  execFileSync("cargo", ["clean", "--release", "--target", "wasm32-unknown-unknown"], {
    cwd: engine,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  execFileSync("cargo", ["build", "--release", "--lib", "--target", "wasm32-unknown-unknown"], {
    cwd: engine,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, RUSTFLAGS: remapped },
  });
  if (args.has("--install")) copyFileSync(built, pkg);
  const fresh = sha(built);
  console.log("built  " + fresh);
  if (fresh !== sha(pkg)) {
    console.error(
      "MISMATCH: fresh build differs from pkg/lok_engine.wasm (stale bundle or different toolchain)",
    );
    ok = false;
  }
}

const shipped = sha(pkg);
console.log("pkg    " + shipped);
console.log("pin    " + (pin ?? "(missing)"));
if (shipped !== pin) {
  console.error(
    "MISMATCH: pkg/lok_engine.wasm differs from LOCAL_RULESET_WASM_SHA256 in apps/server/src/lok-vault.ts",
  );
  ok = false;
}
if (args.has("--install")) {
  console.log("install digest (update LOCAL_RULESET_WASM_SHA256 to): " + shipped);
}
process.exit(ok ? 0 : 1);

/**
 * Phase 0 load harness. Spawns N play-bot.ts processes against a local server.
 *
 *   pnpm --filter @bellgrave/server exec tsx scripts/load-bots.ts --bots 8 --seconds 30
 *   pnpm --filter @bellgrave/server exec tsx scripts/load-bots.ts --bots 4 --seconds 20 --ws ws://127.0.0.1:8787
 */
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildLoadFleet } from "../src/load-fleet.ts";

function parseArgs(argv: string[]) {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg?.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      out[key] = next;
      i++;
    } else out[key] = "true";
  }
  return out;
}

function assertLocalWs(wsUrl: string) {
  const url = new URL(wsUrl);
  if (url.protocol !== "ws:" && url.protocol !== "wss:") {
    throw new Error("ws url must be ws:// or wss://");
  }
  const host = url.hostname;
  if (host !== "127.0.0.1" && host !== "localhost" && host !== "::1") {
    throw new Error("load-bots only connects to a local server");
  }
}

const here = dirname(fileURLToPath(import.meta.url));

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const bots = Number(args.bots ?? 4);
  const seconds = args.seconds ?? "30";
  const ws = args.ws ?? "ws://127.0.0.1:8787";
  assertLocalWs(ws);
  const fleet = buildLoadFleet(bots);
  const playBot = resolve(here, "play-bot.ts");
  console.log("[load-bots] " + fleet.length + " play-bot process(es) for " + seconds + "s on " + ws);
  const children = fleet.map((spec) =>
    spawn(
      process.execPath,
      ["--import", "tsx", playBot, "--job", spec.job, "--id", spec.id, "--seconds", seconds, "--ws", ws],
      { stdio: "inherit" },
    ),
  );
  const codes = await Promise.all(
    children.map(
      (child) =>
        new Promise<number>((resolveCode) => {
          child.on("exit", (code) => resolveCode(code ?? 1));
        }),
    ),
  );
  const failed = codes.filter((code) => code !== 0).length;
  if (failed > 0) {
    console.error("[load-bots] " + failed + " bot(s) exited non-zero");
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

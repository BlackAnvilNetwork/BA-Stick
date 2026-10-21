import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** Fill empty env keys from a gitignored local file. Never overrides a value already set. */
export function loadLokEnv(env: NodeJS.ProcessEnv = process.env, paths?: string[]): void {
  const files =
    paths ??
    [
      join(here, "../.env.local"),
      join(here, "../../../.env.local"),
      // Cloud Agent secure store (never committed).
      "/cursor/stores/self/secure/server-keys.env",
    ];
  for (const path of files) {
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (env[key] == null || env[key] === "") env[key] = value;
    }
  }
}

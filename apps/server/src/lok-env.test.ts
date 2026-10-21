import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadLokEnv } from "./lok-env";

test("loadLokEnv fills blanks and does not override", () => {
  const dir = mkdtempSync(join(tmpdir(), "lok-env-"));
  const file = join(dir, ".env.local");
  writeFileSync(file, 'LOK_CHAIN_RPC=http://127.0.0.1:8545\nLOK_KEK=0xabc\n# comment\n');
  const env: NodeJS.ProcessEnv = { LOK_KEK: "0xkeep" };
  loadLokEnv(env, [file]);
  assert.equal(env.LOK_CHAIN_RPC, "http://127.0.0.1:8545");
  assert.equal(env.LOK_KEK, "0xkeep");
});

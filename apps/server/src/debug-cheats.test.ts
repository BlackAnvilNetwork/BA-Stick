import assert from "node:assert/strict";
import test from "node:test";
import { debugCheatsEnabled } from "./debug-cheats";

test("debug cheats are opt-in and refuse production chains", () => {
  assert.equal(debugCheatsEnabled({} as NodeJS.ProcessEnv), false);
  assert.equal(debugCheatsEnabled({ NODE_ENV: "development" } as NodeJS.ProcessEnv), false);
  assert.equal(debugCheatsEnabled({ NODE_ENV: "production" } as NodeJS.ProcessEnv), false);
  assert.equal(debugCheatsEnabled({ ALLOW_DEBUG_CHEATS: "0" } as NodeJS.ProcessEnv), false);

  assert.equal(debugCheatsEnabled({ ALLOW_DEBUG_CHEATS: "1" } as NodeJS.ProcessEnv), true);
  assert.equal(debugCheatsEnabled({ ALLOW_DEBUG_CHEATS: "1", NODE_ENV: "production" } as NodeJS.ProcessEnv), true);
  assert.equal(debugCheatsEnabled({ ALLOW_DEBUG_CHEATS: "1", NETWORK: "anvil" } as NodeJS.ProcessEnv), true);

  assert.equal(debugCheatsEnabled({ ALLOW_DEBUG_CHEATS: "1", NETWORK: "gnosis" } as NodeJS.ProcessEnv), false);
  assert.equal(debugCheatsEnabled({ ALLOW_DEBUG_CHEATS: "1", NETWORK: "chiado" } as NodeJS.ProcessEnv), false);
  assert.equal(debugCheatsEnabled({ ALLOW_DEBUG_CHEATS: "1", LOK_CHAIN_ID: "100" } as NodeJS.ProcessEnv), false);
  assert.equal(debugCheatsEnabled({ ALLOW_DEBUG_CHEATS: "1", LOK_CHAIN_ID: "10200" } as NodeJS.ProcessEnv), false);
});

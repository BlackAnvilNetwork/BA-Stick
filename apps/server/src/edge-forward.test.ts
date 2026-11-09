import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { privateKeyToAccount } from "viem/accounts";
import {
  APPEND_REFUSED,
  decideWritePath,
  recoverSpawnSigner,
  spawnInputMessage,
  validateSpawnInput,
  type SpawnInput,
} from "./edge-forward";

describe("edge forward", () => {
  it("a non-leader forwards and a leader appends", () => {
    assert.equal(decideWritePath(true, false), "local");
    assert.equal(decideWritePath(false, true), "forward");
    assert.equal(decideWritePath(false, false), "refuse");
    assert.equal(APPEND_REFUSED.length > 0, true);
  });

  it("rejects a spawn the signer does not own", async () => {
    const account = privateKeyToAccount(("0x" + "11".repeat(32)) as `0x${string}`);
    const body = {
      op: "spawn" as const,
      wallet: account.address,
      tokenId: "6",
      startingJob: 4,
      name: "Mint 6",
    };
    const signature = await account.signMessage({ message: spawnInputMessage(body) });
    const input: SpawnInput = { ...body, signature };
    const signer = await recoverSpawnSigner(input);
    assert.equal(validateSpawnInput(input, signer, { tokenInJournal: false, nameTaken: false }).ok, true);
    const forged: SpawnInput = { ...input, wallet: "0x" + "22".repeat(20) };
    const refused = validateSpawnInput(forged, signer, { tokenInJournal: false, nameTaken: false });
    assert.equal(refused.ok, false);
    assert.equal(validateSpawnInput(input, signer, { tokenInJournal: true, nameTaken: false }).ok, false);
  });
});

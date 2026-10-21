import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { LokWorld } from "./lok-world";
import { provisionalChainLink, sealParentRoot, sealTickBatch } from "./seal-tick-batch";

function zeros(): Uint8Array {
  return new Uint8Array(32);
}

/** Same 8-byte big-endian tick index the live tick seals as its inputs. */
function tickIndexInputs(index: number): Uint8Array {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigUint64(0, BigInt(index), false);
  return out;
}

test("the live seal stores the character-root tree, not the provisional chain link", () => {
  const dir = mkdtempSync(join(tmpdir(), "lok-character-root-"));
  const lok = LokWorld.open(dir, undefined, {});
  const empty = lok.characterRootTreeRoot();
  assert.equal(empty.length, 32);
  assert.deepEqual(empty, zeros());
  const emptyInputs = tickIndexInputs(1);
  const emptyParent = sealParentRoot();
  assert.notDeepEqual(empty, provisionalChainLink(emptyParent, emptyInputs));

  const sealedEmpty = sealTickBatch({
    inputs: emptyInputs,
    rollBytes: new Uint8Array(0),
    rulesetHash: zeros(),
    gnosisRandomness: zeros(),
    parentRoot: emptyParent,
    chainLink: empty,
  });
  assert.deepEqual(sealedEmpty, { ok: true, epoch: 0, height: 0 });
  assert.deepEqual(sealParentRoot(), empty);

  const spawned = lok.spawn("char-a", "Ada", 0);
  assert.equal(spawned.ok, true);
  const characterRoot = lok.characterRootTreeRoot();
  assert.equal(characterRoot.length, 32);
  assert.notDeepEqual(characterRoot, zeros());
  const parent = sealParentRoot();
  const inputs = tickIndexInputs(2);
  const provisional = provisionalChainLink(parent, inputs);
  assert.notDeepEqual(characterRoot, provisional);

  const sealed = sealTickBatch({
    inputs,
    rollBytes: new Uint8Array(0),
    rulesetHash: zeros(),
    gnosisRandomness: zeros(),
    parentRoot: parent,
    chainLink: characterRoot,
  });
  assert.deepEqual(sealed, { ok: true, epoch: 0, height: 1 });
  assert.deepEqual(sealParentRoot(), characterRoot);
  assert.notDeepEqual(sealParentRoot(), provisional);
});

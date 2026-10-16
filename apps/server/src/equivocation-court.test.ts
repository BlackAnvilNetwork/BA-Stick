/**
 * A local equivocation court slashes only when two signatures reproduce.
 * The slash is the bond already posted for that signer, written to zero.
 * No posted bond is not a slash. A vote cannot slash, and a vote cannot
 * refuse. The tick does not wait.
 */
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import { bls12_381 } from "@noble/curves/bls12-381.js";
import { concatBytes, keccak256 } from "viem";
import { HASH_BYTES, type BatchEnvelope } from "./batch-envelope";
import {
  bondedCommitThreshold,
  postReplicaBond,
  registryAdmin,
  resetBondedAdmissionForTests,
  votingReplica,
  votingSet,
  votingSetCommitThreshold,
} from "./bonded-admission";
import {
  equivocationSignerId,
  resetEquivocationCourtForTests,
  signerSlash,
  submitEquivocationPair,
  type CourtBallot,
} from "./equivocation-court";
import { submitOnSimTick } from "./order-submit";
import {
  configureEpochLedger,
  notePostedSlashableBond,
  postedSlashableBond,
  postedSlashableBonds,
  resetRootAnchorForTests,
  restartEpochLedger,
  setPostedSlashableBonds,
} from "./root-anchor";

const bls = bls12_381.longSignatures;
const leader = bls.keygen();
const other = bls.keygen();
const leaderKey = new Uint8Array(leader.publicKey.toBytes());
const leaderSecret = new Uint8Array(leader.secretKey);
const otherKey = new Uint8Array(other.publicKey.toBytes());
const otherSecret = new Uint8Array(other.secretKey);

const APPROVE: CourtBallot = { admin: true, multisig: true, social: true };
const REFUSE: CourtBallot = { admin: false, multisig: false, social: false };

function hash(fill: number): Uint8Array {
  const out = new Uint8Array(HASH_BYTES);
  out.fill(fill);
  return out;
}

function envelope(over: Partial<BatchEnvelope> = {}): BatchEnvelope {
  return {
    inputs: Uint8Array.from([1, 2, 3, 4]),
    inputsCommitment: hash(0x11),
    parentRoot: hash(0x21),
    nextRoot: hash(0x31),
    rulesetHash: hash(0x41),
    epoch: 4,
    height: 9,
    worldId: "bellgrave",
    protocolVersion: "1",
    leaderCommitment: hash(0x51),
    gnosisRandomness: hash(0x61),
    epochSeed: hash(0x71),
    rollCommitment: hash(0x81),
    ...over,
  };
}

/** Independent copy of the batch signing preimage. */
function specSigningMessage(batch: BatchEnvelope): Uint8Array {
  const epoch = new Uint8Array(8);
  const height = new Uint8Array(8);
  new DataView(epoch.buffer).setBigUint64(0, BigInt(batch.epoch), false);
  new DataView(height.buffer).setBigUint64(0, BigInt(batch.height), false);
  return new Uint8Array(
    keccak256(
      concatBytes([
        new TextEncoder().encode("bellgrave-batch-v1"),
        batch.inputsCommitment,
        batch.parentRoot,
        batch.nextRoot,
        batch.rulesetHash,
        batch.epochSeed,
        batch.rollCommitment,
        epoch,
        height,
        new TextEncoder().encode(batch.worldId),
        new TextEncoder().encode(batch.protocolVersion),
      ]),
      "bytes",
    ),
  );
}

function sign(batch: BatchEnvelope, secret: Uint8Array): Uint8Array {
  const hashed = bls.hash(specSigningMessage(batch));
  return new Uint8Array(bls.sign(hashed, secret).toBytes());
}

function signed(
  over: Partial<BatchEnvelope> = {},
  secret: Uint8Array = leaderSecret,
): BatchEnvelope {
  const batch = envelope(over);
  return { ...batch, signature: sign(batch, secret) };
}

function reset(): void {
  resetEquivocationCourtForTests();
  resetBondedAdmissionForTests();
  resetRootAnchorForTests();
}

function bondRows(dir: string): { id: string; amountWei: string }[] {
  const parsed = JSON.parse(readFileSync(join(dir, "slashable-bonds.json"), "utf8")) as {
    bonds?: { id?: string; amountWei?: string }[];
  };
  return (parsed.bonds ?? []).map((row) => ({ id: row.id ?? "", amountWei: row.amountWei ?? "" }));
}

describe("equivocation court", { concurrency: false }, () => {
  test("two signatures at one epoch and height with different roots slash the posted bond", () => {
    reset();
    const dir = mkdtempSync(join(tmpdir(), "lok-court-slash-"));
    try {
      configureEpochLedger(dir);
      const id = equivocationSignerId(leaderKey);
      const otherId = equivocationSignerId(otherKey);
      const bond = 123456789n;
      notePostedSlashableBond(id, bond);
      notePostedSlashableBond(otherId, 999n);
      assert.equal(postedSlashableBond(id), bond);
      assert.equal(postedSlashableBonds(), bond + 999n);

      const left = signed({ nextRoot: hash(0x31), parentRoot: hash(0x21) });
      const right = signed({ nextRoot: hash(0x32), parentRoot: hash(0x22) });
      assert.equal(left.epoch, right.epoch);
      assert.equal(left.height, right.height);
      assert.notDeepEqual(left.nextRoot, right.nextRoot);

      const result = submitEquivocationPair(left, right, leaderKey);
      assert.equal(result instanceof Promise, false);
      assert.deepEqual(result, { slashed: true, amountWei: bond });
      assert.deepEqual(signerSlash(leaderKey), { slashed: true, amountWei: bond });
      assert.deepEqual(signerSlash(otherKey), { slashed: false });
      assert.equal(postedSlashableBond(id), 0n);
      assert.equal(postedSlashableBond(otherId), 999n);
      assert.equal(postedSlashableBonds(), 999n);
      assert.deepEqual(bondRows(dir), [{ id: otherId, amountWei: "999" }]);

      const filed = readFileSync(join(dir, "slashable-bonds.json"), "utf8");
      const again = submitEquivocationPair(left, right, leaderKey);
      assert.deepEqual(again, { slashed: false });
      assert.deepEqual(signerSlash(leaderKey), { slashed: true, amountWei: bond });
      assert.equal(postedSlashableBond(id), 0n);
      assert.equal(readFileSync(join(dir, "slashable-bonds.json"), "utf8"), filed);

      notePostedSlashableBond(id, 1n);
      const relisted = submitEquivocationPair(right, left, leaderKey);
      assert.deepEqual(relisted, { slashed: true, amountWei: 1n });
      assert.equal(postedSlashableBond(id), 0n);
      assert.deepEqual(signerSlash(leaderKey), { slashed: true, amountWei: 1n });
      assert.deepEqual(bondRows(dir), [{ id: otherId, amountWei: "999" }]);

      restartEpochLedger();
      assert.equal(postedSlashableBond(id), 0n);
      assert.equal(postedSlashableBond(otherId), 999n);
      assert.equal(postedSlashableBonds(), 999n);
      assert.deepEqual(bondRows(dir), [{ id: otherId, amountWei: "999" }]);

      const tick = submitOnSimTick(null, { ok: true, height: left.height, nextRoot: left.nextRoot });
      assert.equal(tick.tickFailed, false);
      assert.equal(tick.status, "provisional");
    } finally {
      reset();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a pair with no posted bond is not a slash", () => {
    reset();
    const dir = mkdtempSync(join(tmpdir(), "lok-court-none-"));
    try {
      configureEpochLedger(dir);
      const id = equivocationSignerId(leaderKey);
      setPostedSlashableBonds(10n ** 18n);
      assert.equal(postedSlashableBond(id), 0n);
      const left = signed({ nextRoot: hash(0x31) });
      const right = signed({ nextRoot: hash(0x32) });
      const result = submitEquivocationPair(left, right, leaderKey);
      assert.deepEqual(result, { slashed: false });
      assert.deepEqual(signerSlash(leaderKey), { slashed: false });
      assert.equal(postedSlashableBonds(), 10n ** 18n);
      assert.equal(postedSlashableBond(id), 0n);
      assert.equal(existsSync(join(dir, "slashable-bonds.json")), false);

      notePostedSlashableBond(id, 5n);
      notePostedSlashableBond(id, 0n);
      assert.equal(postedSlashableBond(id), 0n);
      const before = readFileSync(join(dir, "slashable-bonds.json"), "utf8");
      const zeroed = submitEquivocationPair(left, right, leaderKey);
      assert.deepEqual(zeroed, { slashed: false });
      assert.deepEqual(signerSlash(leaderKey), { slashed: false });
      assert.equal(readFileSync(join(dir, "slashable-bonds.json"), "utf8"), before);
      assert.equal(postedSlashableBond(id), 0n);
      assert.equal(postedSlashableBonds(), 10n ** 18n);
    } finally {
      reset();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("the same root is not equivocation", () => {
    reset();
    try {
      const id = equivocationSignerId(leaderKey);
      notePostedSlashableBond(id, 50n);
      const root = hash(0x31);
      const left = signed({ nextRoot: root, inputs: Uint8Array.from([1]) });
      const right = signed({ nextRoot: root, inputs: Uint8Array.from([2]) });
      const result = submitEquivocationPair(left, right, leaderKey, APPROVE);
      assert.deepEqual(result, { slashed: false });
      assert.deepEqual(signerSlash(leaderKey), { slashed: false });
      assert.equal(postedSlashableBond(id), 50n);
    } finally {
      reset();
    }
  });

  test("a different epoch is not equivocation", () => {
    reset();
    try {
      const id = equivocationSignerId(leaderKey);
      notePostedSlashableBond(id, 50n);
      const left = signed({ epoch: 4, height: 9, nextRoot: hash(0x31) });
      const right = signed({ epoch: 5, height: 9, nextRoot: hash(0x32) });
      const result = submitEquivocationPair(left, right, leaderKey, APPROVE);
      assert.deepEqual(result, { slashed: false });
      assert.deepEqual(signerSlash(leaderKey), { slashed: false });
      assert.equal(postedSlashableBond(id), 50n);
    } finally {
      reset();
    }
  });

  test("a different height is not equivocation", () => {
    reset();
    try {
      const id = equivocationSignerId(leaderKey);
      notePostedSlashableBond(id, 50n);
      const left = signed({ epoch: 4, height: 9, nextRoot: hash(0x31) });
      const right = signed({ epoch: 4, height: 10, nextRoot: hash(0x32) });
      const result = submitEquivocationPair(left, right, leaderKey, APPROVE);
      assert.deepEqual(result, { slashed: false });
      assert.deepEqual(signerSlash(leaderKey), { slashed: false });
      assert.equal(postedSlashableBond(id), 50n);
    } finally {
      reset();
    }
  });

  test("a different signer is not equivocation", () => {
    reset();
    try {
      const leaderId = equivocationSignerId(leaderKey);
      const otherId = equivocationSignerId(otherKey);
      notePostedSlashableBond(leaderId, 50n);
      notePostedSlashableBond(otherId, 80n);
      const left = signed({ nextRoot: hash(0x31) }, leaderSecret);
      const right = signed({ nextRoot: hash(0x32) }, otherSecret);
      assert.deepEqual(submitEquivocationPair(left, right, leaderKey, APPROVE), { slashed: false });
      assert.deepEqual(submitEquivocationPair(left, right, otherKey, APPROVE), { slashed: false });
      assert.deepEqual(signerSlash(leaderKey), { slashed: false });
      assert.deepEqual(signerSlash(otherKey), { slashed: false });
      assert.equal(postedSlashableBond(leaderId), 50n);
      assert.equal(postedSlashableBond(otherId), 80n);
      assert.equal(postedSlashableBonds(), 130n);
    } finally {
      reset();
    }
  });

  test("an invalid signature is not equivocation", () => {
    reset();
    try {
      const id = equivocationSignerId(leaderKey);
      notePostedSlashableBond(id, 50n);
      const left = signed({ nextRoot: hash(0x31) });
      const right = signed({ nextRoot: hash(0x31) });
      right.nextRoot = hash(0x32);
      const swapped = submitEquivocationPair(left, right, leaderKey, APPROVE);
      assert.deepEqual(swapped, { slashed: false });

      const missing = envelope({ nextRoot: hash(0x32) });
      const absent = submitEquivocationPair(left, missing, leaderKey, APPROVE);
      assert.deepEqual(absent, { slashed: false });

      const shortRoot = signed({ nextRoot: new Uint8Array(31) });
      const short = submitEquivocationPair(left, shortRoot, leaderKey, APPROVE);
      assert.deepEqual(short, { slashed: false });

      const listingKey = new Uint8Array(32).fill(0x44);
      const listing = submitEquivocationPair(
        signed({ nextRoot: hash(0x31) }),
        signed({ nextRoot: hash(0x32) }),
        listingKey,
        APPROVE,
      );
      assert.deepEqual(listing, { slashed: false });
      assert.deepEqual(signerSlash(leaderKey), { slashed: false });
      assert.deepEqual(signerSlash(listingKey), { slashed: false });
      assert.equal(postedSlashableBond(id), 50n);
    } finally {
      reset();
    }
  });

  test("a vote cannot slash without the pair or refuse a pair that reproduces", async () => {
    reset();
    try {
      const id = equivocationSignerId(leaderKey);
      notePostedSlashableBond(id, 42n);
      const calls: string[] = [];
      const prev = globalThis.fetch;
      globalThis.fetch = (async (_input: unknown, init?: { body?: unknown }) => {
        calls.push(typeof init?.body === "string" ? init.body : "");
        return new Response("refused", { status: 500 });
      }) as typeof fetch;
      try {
        const same = signed({ nextRoot: hash(0x31) });
        const voted = submitEquivocationPair(same, same, leaderKey, APPROVE);
        assert.deepEqual(voted, { slashed: false });
        assert.deepEqual(signerSlash(leaderKey), { slashed: false });
        assert.equal(postedSlashableBond(id), 42n);

        const left = signed({ nextRoot: hash(0x31) });
        const right = signed({ nextRoot: hash(0x32) });
        const refused = submitEquivocationPair(left, right, leaderKey, REFUSE);
        assert.deepEqual(refused, { slashed: true, amountWei: 42n });
        assert.deepEqual(signerSlash(leaderKey), { slashed: true, amountWei: 42n });
        assert.equal(postedSlashableBond(id), 0n);
        assert.equal(calls.length, 0);

        const tick = submitOnSimTick(null, { ok: true, height: 9, nextRoot: hash(0x31) });
        assert.equal(tick.tickFailed, false);
        assert.equal(tick.status, "provisional");
      } finally {
        globalThis.fetch = prev;
      }
    } finally {
      reset();
    }
  });

  test("slashing the posted bond removes that signer from the voting set", async () => {
    reset();
    const dir = mkdtempSync(join(tmpdir(), "lok-court-vote-"));
    try {
      configureEpochLedger(dir);
      const id = equivocationSignerId(leaderKey);
      const before = registryAdmin();
      assert.deepEqual(before, {
        registryOwner: "gnosis-safe",
        slashingAdmin: "gnosis-safe",
        rulesetProposer: "gnosis-safe",
      });
      assert.deepEqual(postReplicaBond(id, "replica", 10n), { joined: true, amountWei: 10n });
      assert.deepEqual(postReplicaBond("replica-b", "replica", 20n), { joined: true, amountWei: 20n });
      assert.deepEqual(postReplicaBond("replica-c", "replica", 30n), { joined: true, amountWei: 30n });
      assert.deepEqual(postReplicaBond("replica-d", "replica", 40n), { joined: true, amountWei: 40n });
      assert.equal(votingSet().length, 4);
      assert.equal(votingSetCommitThreshold(), 3);
      assert.equal(bondedCommitThreshold(4), 3);
      assert.equal(bondedCommitThreshold(3), 2);
      assert.equal(bondedCommitThreshold(7), 4);

      const calls: string[] = [];
      const prev = globalThis.fetch;
      globalThis.fetch = (async (_input: unknown, init?: { body?: unknown }) => {
        calls.push(typeof init?.body === "string" ? init.body : "");
        return new Response("refused", { status: 500 });
      }) as typeof fetch;
      try {
        const left = signed({ nextRoot: hash(0x31) });
        const right = signed({ nextRoot: hash(0x32) });
        const result = submitEquivocationPair(left, right, leaderKey, REFUSE);
        assert.deepEqual(result, { slashed: true, amountWei: 10n });
        assert.equal(postedSlashableBond(id), 0n);
        assert.equal(votingReplica(id), null);
        assert.equal(votingSet().length, 3);
        assert.deepEqual(
          votingSet().map((replica) => replica.id),
          ["replica-b", "replica-c", "replica-d"],
        );
        assert.equal(votingSetCommitThreshold(), 2);
        assert.equal(votingSetCommitThreshold(), bondedCommitThreshold(votingSet().length));
        assert.deepEqual(registryAdmin(), before);
        assert.equal(postedSlashableBond("replica-b"), 20n);
        assert.equal(postedSlashableBond("replica-c"), 30n);
        assert.equal(postedSlashableBond("replica-d"), 40n);
        assert.equal(postedSlashableBonds(), 90n);
        assert.deepEqual(bondRows(dir), [
          { id: "replica-b", amountWei: "20" },
          { id: "replica-c", amountWei: "30" },
          { id: "replica-d", amountWei: "40" },
        ]);

        const tick = submitOnSimTick(null, { ok: true, height: 9, nextRoot: hash(0x31) });
        assert.equal(tick.tickFailed, false);
        assert.equal(tick.status, "provisional");
        assert.equal(calls.length, 0);
      } finally {
        globalThis.fetch = prev;
      }
    } finally {
      reset();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

/**
 * A replica joins the local voting set by posting a bond.
 * The posted amount is the bond. Validators, light clients, and the listing
 * key stay out. The Gnosis Safe stays admin. Fewer than four bonded replicas
 * commit at a majority. Four or more commit at more than two thirds.
 * Joining does not stop the tick and does not broadcast.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  bondedCommitThreshold,
  postReplicaBond,
  registryAdmin,
  resetBondedAdmissionForTests,
  votingReplica,
  votingSet,
  votingSetCommitThreshold,
  type AdmissionBallot,
} from "./bonded-admission";
import { installedGameMode, readResourceSnapshot } from "./installed-game-mode";
import { submitOnSimTick } from "./order-submit";
import { PINNED_GNOSIS_LISTING_ADDRESS } from "./production-boot";
import {
  notePostedSlashableBond,
  postedSlashableBond,
  postedSlashableBonds,
  resetRootAnchorForTests,
} from "./root-anchor";

const REPLACE_SAFE: AdmissionBallot = {
  replaceSafe: true,
  registryOwner: PINNED_GNOSIS_LISTING_ADDRESS,
  slashingAdmin: "0x1111111111111111111111111111111111111111",
  rulesetProposer: "replica-1",
};

function reset(): void {
  resetBondedAdmissionForTests();
  resetRootAnchorForTests();
}

function root(fill: number): Uint8Array {
  const out = new Uint8Array(32);
  out.fill(fill);
  return out;
}

describe("bonded admission", { concurrency: false }, () => {
  test("a replica joins the voting set by the amount it posts", () => {
    reset();
    try {
      const amount = 123456789012345678901234567890n;
      const result = postReplicaBond("replica-a", "replica", amount);
      assert.deepEqual(result, { joined: true, amountWei: amount });
      assert.equal("listingKey" in result, false);
      assert.equal(postedSlashableBond("replica-a"), amount);
      assert.equal(postedSlashableBonds(), amount);
      assert.deepEqual(votingSet(), [{ id: "replica-a", amountWei: amount }]);
      assert.deepEqual(votingReplica("replica-a"), { id: "replica-a", amountWei: amount });
    } finally {
      reset();
    }
  });

  test("one wei joins and a larger posting replaces it, with no default and no ceiling", () => {
    reset();
    try {
      assert.deepEqual(postReplicaBond("replica-a", "replica", 0n), { joined: false, amountWei: 0n });
      assert.equal(postedSlashableBond("replica-a"), 0n);
      assert.equal(votingSet().length, 0);

      assert.deepEqual(postReplicaBond("replica-a", "replica", 1n), { joined: true, amountWei: 1n });
      const ceiling = 10n ** 40n;
      const replaced = postReplicaBond("replica-a", "replica", ceiling);
      assert.deepEqual(replaced, { joined: true, amountWei: ceiling });
      assert.equal(votingSet().length, 1);
      assert.equal(postedSlashableBond("replica-a"), ceiling);
      assert.equal(postedSlashableBonds(), ceiling);

      assert.deepEqual(postReplicaBond("replica-a", "replica", -1n), { joined: false, amountWei: 0n });
      assert.equal(postedSlashableBond("replica-a"), ceiling);
      assert.equal(votingReplica("replica-a")?.amountWei, ceiling);

      assert.deepEqual(postReplicaBond("replica-a", "replica", 0n), { joined: false, amountWei: 0n });
      assert.equal(postedSlashableBond("replica-a"), 0n);
      assert.equal(votingSet().length, 0);
    } finally {
      reset();
    }
  });

  test("a posted bond that is only noted does not join the voting set", () => {
    reset();
    try {
      notePostedSlashableBond("cap-host", 77n);
      assert.equal(postedSlashableBond("cap-host"), 77n);
      assert.equal(votingSet().length, 0);
      assert.equal(votingSetCommitThreshold(), null);
    } finally {
      reset();
    }
  });

  test("a validator does not post a bond and does not join", async () => {
    reset();
    try {
      const mode = await installedGameMode({});
      assert.equal(mode.mode, "validator");
      notePostedSlashableBond("host-a", 50n);
      const result = postReplicaBond("host-a", mode.mode, 50n, REPLACE_SAFE);
      assert.deepEqual(result, { joined: false, amountWei: 0n });
      assert.equal(postedSlashableBond("host-a"), 50n);
      assert.equal(postedSlashableBond("validator-1"), 0n);
      assert.deepEqual(postReplicaBond("validator-1", "validator", 10n), { joined: false, amountWei: 0n });
      assert.equal(votingSet().length, 0);
      assert.deepEqual(registryAdmin(), {
        registryOwner: "gnosis-safe",
        slashingAdmin: "gnosis-safe",
        rulesetProposer: "gnosis-safe",
      });
    } finally {
      reset();
    }
  });

  test("a phone stays a light client and does not post a bond or join", () => {
    reset();
    try {
      const result = postReplicaBond("phone", "light", 25n, REPLACE_SAFE);
      assert.deepEqual(result, { joined: false, amountWei: 0n });
      assert.equal(postedSlashableBond("phone"), 0n);
      assert.equal(votingSet().length, 0);
    } finally {
      reset();
    }
  });

  test("the listing key stays outside the replica set", async () => {
    reset();
    try {
      const mode = await installedGameMode(
        { LOK_REPLICA: "1" },
        {
          readResources: () => readResourceSnapshot(),
          probeReachability: async () => true,
        },
      );
      assert.equal(mode.mode, "replica");
      const listed = postReplicaBond(PINNED_GNOSIS_LISTING_ADDRESS, mode.mode, 10n);
      assert.deepEqual(listed, { joined: false, amountWei: 0n });
      assert.equal(postedSlashableBond(PINNED_GNOSIS_LISTING_ADDRESS), 0n);
      const checksummed = postReplicaBond("0xbFa29a6EE3d1188aa0A9e0c783E5Da620b859E76", "replica", 10n);
      assert.deepEqual(checksummed, { joined: false, amountWei: 0n });
      const bare = postReplicaBond(PINNED_GNOSIS_LISTING_ADDRESS.slice(2), "replica", 4n);
      assert.deepEqual(bare, { joined: false, amountWei: 0n });
      assert.equal(votingSet().length, 0);

      const joined = postReplicaBond("replica-a", mode.mode, 8n);
      assert.deepEqual(joined, { joined: true, amountWei: 8n });
      assert.equal("listingKey" in joined, false);
      assert.equal(votingReplica(PINNED_GNOSIS_LISTING_ADDRESS), null);
    } finally {
      reset();
    }
  });

  test("the Gnosis Safe stays admin when replicas bond, including four of them", () => {
    reset();
    try {
      const before = registryAdmin();
      assert.deepEqual(before, {
        registryOwner: "gnosis-safe",
        slashingAdmin: "gnosis-safe",
        rulesetProposer: "gnosis-safe",
      });
      for (let i = 1; i <= 4; i += 1) {
        const amount = BigInt(i);
        const joined = postReplicaBond("replica-" + i, "replica", amount, REPLACE_SAFE);
        assert.deepEqual(joined, { joined: true, amountWei: amount });
      }
      assert.equal(votingSet().length, 4);
      assert.equal(votingSetCommitThreshold(), 3);
      assert.equal(bondedCommitThreshold(4), 3);
      assert.deepEqual(registryAdmin(), before);
    } finally {
      reset();
    }
  });

  test("three bonded replicas still commit at a majority", () => {
    reset();
    try {
      postReplicaBond("replica-a", "replica", 1n);
      postReplicaBond("replica-b", "replica", 2n);
      postReplicaBond("replica-c", "replica", 3n);
      postReplicaBond("validator-1", "validator", 9n);
      postReplicaBond("phone", "light", 9n);
      postReplicaBond(PINNED_GNOSIS_LISTING_ADDRESS, "replica", 9n);
      assert.equal(votingSet().length, 3);
      assert.equal(votingReplica("validator-1"), null);
      assert.equal(votingReplica("phone"), null);
      assert.equal(votingReplica(PINNED_GNOSIS_LISTING_ADDRESS), null);
      const threshold = votingSetCommitThreshold();
      assert.equal(threshold, 2);
      assert.equal(threshold, 1 + Math.floor(3 / 2));
      assert.equal(bondedCommitThreshold(3), threshold);
      assert.equal(2 >= threshold!, true);
      assert.equal(1 >= threshold!, false);
      assert.deepEqual(registryAdmin(), {
        registryOwner: "gnosis-safe",
        slashingAdmin: "gnosis-safe",
        rulesetProposer: "gnosis-safe",
      });
    } finally {
      reset();
    }
  });

  test("four bonded replicas commit at more than two thirds", () => {
    reset();
    try {
      for (let i = 1; i <= 4; i += 1) {
        const amount = BigInt(i);
        const joined = postReplicaBond("replica-" + i, "replica", amount, REPLACE_SAFE);
        assert.deepEqual(joined, { joined: true, amountWei: amount });
      }
      postReplicaBond("validator-1", "validator", 9n);
      postReplicaBond("phone", "light", 9n);
      postReplicaBond(PINNED_GNOSIS_LISTING_ADDRESS, "replica", 9n);
      assert.equal(votingSet().length, 4);
      const threshold = votingSetCommitThreshold();
      assert.equal(threshold, 3);
      assert.equal(threshold, Math.floor((2 * 4) / 3) + 1);
      assert.equal(bondedCommitThreshold(4), threshold);
      assert.equal(threshold! * 3 > 2 * 4, true);
      assert.equal((threshold! - 1) * 3 > 2 * 4, false);
      assert.equal(3 >= threshold!, true);
      assert.equal(2 >= threshold!, false);
      postReplicaBond("replica-5", "replica", 5n);
      assert.equal(votingSet().length, 5);
      assert.equal(votingSetCommitThreshold(), 4);
      assert.equal(votingSetCommitThreshold(), Math.floor((2 * 5) / 3) + 1);
      assert.equal(4 >= votingSetCommitThreshold()!, true);
      assert.equal(3 >= votingSetCommitThreshold()!, false);
      assert.deepEqual(registryAdmin(), {
        registryOwner: "gnosis-safe",
        slashingAdmin: "gnosis-safe",
        rulesetProposer: "gnosis-safe",
      });
    } finally {
      reset();
    }
  });

  test("the commit threshold is a majority below four and more than two thirds from four", () => {
    reset();
    try {
      assert.equal(bondedCommitThreshold(0), null);
      assert.equal(bondedCommitThreshold(1), 1);
      assert.equal(bondedCommitThreshold(2), 2);
      assert.equal(bondedCommitThreshold(3), 2);
      assert.equal(bondedCommitThreshold(4), 3);
      assert.equal(bondedCommitThreshold(5), 4);
      assert.equal(bondedCommitThreshold(7), 5);
      postReplicaBond("replica-a", "replica", 1n);
      assert.equal(votingSetCommitThreshold(), 1);
      postReplicaBond("replica-b", "replica", 2n);
      postReplicaBond("replica-c", "replica", 3n);
      assert.equal(votingSet().length, 3);
      assert.equal(votingSetCommitThreshold(), 2);
      for (let i = 0; i < 4; i += 1) postReplicaBond("more-" + i, "replica", 1n);
      assert.equal(votingSet().length, 7);
      assert.equal(votingSetCommitThreshold(), 5);
      assert.equal(postedSlashableBonds(), 1n + 2n + 3n + 4n);
    } finally {
      reset();
    }
  });

  test("joining does not stop the 20 Hz tick and does not broadcast", async () => {
    reset();
    try {
      const calls: string[] = [];
      const prev = globalThis.fetch;
      globalThis.fetch = (async (_input: unknown, init?: { body?: unknown }) => {
        calls.push(typeof init?.body === "string" ? init.body : "");
        return new Response("refused", { status: 500 });
      }) as typeof fetch;
      try {
        const joined = postReplicaBond("replica-a", "replica", 3n, REPLACE_SAFE);
        assert.deepEqual(joined, { joined: true, amountWei: 3n });
        const tick = submitOnSimTick(null, { ok: true, height: 9, nextRoot: root(0x31) });
        assert.equal(tick.tickFailed, false);
        assert.equal(tick.status, "provisional");
        assert.equal(tick.blob, null);
        assert.equal(calls.length, 0);
        assert.equal(votingReplica("replica-a")?.amountWei, 3n);
      } finally {
        globalThis.fetch = prev;
      }
    } finally {
      reset();
    }
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { can, leaseFor, STAND_IN_HOLDER, type CapabilityOp, type Role } from "./capability";
import type { WorldSync } from "./world-sync";

const identified: WorldSync = { state: "identified" };
const hole: WorldSync = { state: "missing-history", tokenIds: ["6"] };
const ops: CapabilityOp[] = ["tick", "login", "append", "forward"];
const roles: Role[] = ["observer", "replica"];

describe("capability", () => {
  it("asks one function for every op, role, and sync", () => {
    const syncs: WorldSync[] = [
      identified,
      { state: "genesis" },
      hole,
      { state: "refused", reason: "empty-directory", detail: "no" },
      { state: "not-synced", detail: "empty" },
      { state: "behind-tail", localHead: "1", publishedHead: "2" },
    ];
    for (const op of ops) {
      for (const role of roles) {
        for (const sync of syncs) {
          const lease = leaseFor(role, null, "");
          assert.equal(typeof can(op, role, sync, lease), "boolean");
        }
      }
    }
  });

  it("an observer never appends, and a replica stand-in does when the world is identified", () => {
    const observer = leaseFor("observer", null, "");
    const replica = leaseFor("replica", null, "");
    assert.equal(observer.kind, "absent");
    assert.equal(replica.kind, "held");
    if (replica.kind === "held") assert.equal(replica.holder, STAND_IN_HOLDER);
    assert.equal(can("append", "observer", identified, observer), false);
    assert.equal(can("tick", "observer", identified, observer), false);
    assert.equal(can("login", "observer", identified, observer), true);
    assert.equal(can("forward", "observer", identified, observer), true);
    assert.equal(can("append", "replica", identified, replica), true);
    assert.equal(can("forward", "replica", identified, replica), false);
    assert.equal(can("append", "replica", hole, replica), false);
    assert.equal(can("login", "replica", hole, replica), false);
  });

  it("a published epoch leases only the named leader", () => {
    const published = { epoch: 4n, leader: "0xabc" };
    const held = leaseFor("replica", published, "0xAbC");
    const other = leaseFor("replica", published, "0xdef");
    assert.equal(held.kind, "held");
    assert.equal(other.kind, "absent");
    assert.equal(can("append", "replica", identified, other), false);
    assert.equal(can("forward", "replica", identified, other), true);
    assert.equal(can("tick", "replica", identified, held), true);
  });
});

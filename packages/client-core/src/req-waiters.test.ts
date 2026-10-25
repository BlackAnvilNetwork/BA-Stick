// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ReqWaiters } from "./req-waiters";

describe("ReqWaiters", () => {
  it("a later request does not orphan an earlier pending one (admitFill then pinFill)", async () => {
    const w = new ReqWaiters<string>();
    const admit = w.open(1_000, () => "timeout");
    const pin = w.open(1_000, () => "timeout");
    assert.notEqual(admit.req, pin.req);
    assert.equal(w.settle(admit.req, "admitted"), true);
    assert.equal(w.settle(pin.req, "pinned"), true);
    assert.equal(await admit.done, "admitted");
    assert.equal(await pin.done, "pinned");
    assert.equal(w.size, 0);
  });

  it("ignores late or unknown replies and times out on its own", async () => {
    const w = new ReqWaiters<string>();
    const a = w.open(5, () => "timeout");
    assert.equal(await a.done, "timeout");
    assert.equal(w.settle(a.req, "late"), false);
    assert.equal(w.settle(999, "x"), false);
  });

  it("settleAll resolves everything pending", async () => {
    const w = new ReqWaiters<string>();
    const a = w.open(1_000, () => "timeout");
    const b = w.open(1_000, () => "timeout");
    w.settleAll(() => "closed");
    assert.deepEqual(await Promise.all([a.done, b.done]), ["closed", "closed"]);
    assert.equal(w.size, 0);
  });
});

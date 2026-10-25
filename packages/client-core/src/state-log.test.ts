// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SnapshotMessage } from "@bellgrave/protocol";
import { LOCAL_LOG_MS, useGame } from "./state";

const snap = (tick: number, log: string[]) =>
  ({ type: "snapshot", tick, units: [], log, you: {} }) as unknown as SnapshotMessage;

describe("game log", () => {
  it("keeps client-side lines (errors) across server snapshots, then expires them", () => {
    const g = useGame.getState();
    g.setSnapshot(snap(1, ["server a"]));
    g.pushLog("Error: Not enough gold.");
    g.setSnapshot(snap(2, ["server a", "server b"]));
    assert.deepEqual(useGame.getState().logs, ["server a", "server b", "Error: Not enough gold."]);
    const realNow = Date.now;
    try {
      Date.now = () => realNow() + LOCAL_LOG_MS + 1;
      useGame.getState().setSnapshot(snap(3, ["server b"]));
      assert.deepEqual(useGame.getState().logs, ["server b"]);
    } finally {
      Date.now = realNow;
    }
  });
});

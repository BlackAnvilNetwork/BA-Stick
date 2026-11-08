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

  it("keeps a WS log line until the snapshot includes it", () => {
    const g = useGame.getState();
    g.setSnapshot(snap(18, []));
    g.pushLog("You hit a rat.", { local: false });
    g.setSnapshot(snap(19, ["other line"]));
    assert.deepEqual(useGame.getState().logs, ["other line", "You hit a rat."]);
  });

  it("does not duplicate a WS log line that is also in the snapshot", () => {
    const g = useGame.getState();
    g.setSnapshot(snap(20, []));
    g.pushLog("You hit a rat.", { local: false });
    g.setSnapshot(snap(21, ["You hit a rat."]));
    assert.deepEqual(useGame.getState().logs, ["You hit a rat."]);
  });

  it("keeps chat lines off the combat log", () => {
    const g = useGame.getState();
    g.setSnapshot(snap(10, ["You hit a rat."]));
    g.pushChat({ channel: "say", fromId: "0x1", fromName: "That", text: "hello" });
    assert.deepEqual(useGame.getState().logs, ["You hit a rat."]);
    assert.equal(useGame.getState().chats.at(-1)?.text, "hello");
    g.clearSnapshot();
    assert.deepEqual(useGame.getState().chats, []);
  });

  it("clearSnapshot drops leftover NPC dialog and slain prompt", () => {
    const g = useGame.getState();
    g.setNpcDialog({ npcId: "smith", title: "Smith", body: "Hi" });
    g.setPvpSlainPrompt({ slayerName: "X", bountyWei: "1", areaId: "pit" });
    g.clearSnapshot();
    assert.equal(useGame.getState().npcDialog, null);
    assert.equal(useGame.getState().pvpSlainPrompt, null);
  });

  it("clears npcDialog when the zone changes", () => {
    const g = useGame.getState();
    g.setSnapshot({ ...snap(40, []), you: { zoneId: "pale_hollow" } } as unknown as SnapshotMessage);
    g.setNpcDialog({ npcId: "smith", title: "Smith", body: "Hi" });
    g.setSnapshot({ ...snap(41, []), you: { zoneId: "emberwatch" } } as unknown as SnapshotMessage);
    assert.equal(useGame.getState().npcDialog, null);
  });
});

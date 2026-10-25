import assert from "node:assert/strict";
import { test } from "node:test";
import type { SnapshotMessage } from "@bellgrave/protocol";
import { useGame } from "./state";

function snap(tick: number, main: number | null): SnapshotMessage {
  const equip = {
    head: null,
    body: null,
    hands: null,
    legs: null,
    feet: null,
    ring: null,
    ring2: null,
    earring: null,
    main,
    sub: null,
    grip: null,
    ranged: null,
    ammo: null,
  };
  return {
    type: "snapshot",
    tick,
    you: {
      job: "knight",
      subjob: null,
      subLevel: 0,
      level: 10,
      xp: 0,
      dust: 0,
      claimedStarter: true,
      inventory: [],
      equip,
      baseMats: {},
      craftSkills: {},
      zoneId: "pale_hollow",
      recasts: {},
      unlocked: [],
      learned: [],
      skillUnlocked: [],
      skillPoints: 0,
      skillPrestige: 0,
      freeStatPoints: 0,
      freeStats: {},
      questLog: [],
    },
    units: [],
    log: [],
  } as SnapshotMessage;
}

test("same-tick snapshot still applies equip changes", () => {
  useGame.setState({ wallet: null, snapshot: null, light: { leaderView: "provisional", committed: null } });
  useGame.getState().setSnapshot(snap(5, 4));
  useGame.getState().setSnapshot(snap(5, 1064));
  assert.equal(useGame.getState().snapshot?.you.equip.main, 1064);
});

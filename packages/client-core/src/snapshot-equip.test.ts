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
      nearCrafter: false,
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

test("same-tick snapshot still applies Druid form", () => {
  useGame.setState({ wallet: "0xme", snapshot: null, light: { leaderView: "provisional", committed: null } });
  const walker = snap(9, 4);
  walker.units = [
    {
      id: "0xme",
      kind: "player",
      name: "Druid",
      x: 0,
      y: 0,
      z: 0,
      facing: 0,
      hp: 1,
      maxHp: 1,
      mp: 0,
      maxMp: 0,
      tp: 0,
      anim: "idle",
      animUntil: 0,
      targetId: null,
      job: "druid",
      buffs: { druidForm: 0 },
    } as SnapshotMessage["units"][number],
  ];
  const bear = {
    ...walker,
    log: ["You borrow Stick Bear."],
    units: [{ ...walker.units[0]!, buffs: { druidForm: 1 } as SnapshotMessage["units"][number]["buffs"] }],
  };
  useGame.getState().setSnapshot(walker);
  useGame.getState().setSnapshot(bear);
  assert.equal(useGame.getState().snapshot?.units[0]?.buffs.druidForm, 1);
});

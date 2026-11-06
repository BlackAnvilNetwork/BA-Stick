import type { PaleHollowQuestDef } from "../pale-hollow-field";

export const MAYFLOWER_RING_SITE = { x: 174, z: 191.5 } as const;

export const MORNING_CHAPTER: PaleHollowQuestDef = {
  id: "ph-wenna-chapter",
  npcId: "npc-ph-herald",
  title: "Morning Chapter",
  kind: "fetch",
  requires: "ph-wenna-tally",
  offer:
    "The seven stones stand inside the Scout Gate. That's the Mayflower Ring. The morning chapter lives there, not in my book. Listen, then come back.",
  progress: "The Mayflower Ring has not heard you yet.",
  done: "Crown's own news, read fair. Now you know whose ground this is. If the stones took you, they took you.",
  gold: 30,
  need: 1,
  mobIds: [],
  sites: [
    {
      id: "mayflower-ring",
      name: "Mayflower Ring",
      x: MAYFLOWER_RING_SITE.x,
      z: MAYFLOWER_RING_SITE.z,
      r: 3.2,
      line: "Seven stones of the Mayflower Ring. The morning chapter is not written. It is stood.",
    },
  ],
};

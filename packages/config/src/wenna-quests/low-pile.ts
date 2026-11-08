import type { PaleHollowQuestDef } from "../pale-hollow-field";

export const ASHBEAM_LOG_SPAWNS = ["ph-ash-a", "ph-ash-b", "ph-ash-c", "ph-ash-d", "ph-ash-e"] as const;

export const LOW_PILE: PaleHollowQuestDef = {
  id: "ph-wenna-emberwood",
  npcId: "npc-ph-herald",
  title: "The Low Pile",
  kind: "gather",
  requires: "ph-wenna-watch",
  offer:
    "Crown's news from the camp fire: the woodpile will not last the watch. Follow the stream out of camp until the pale ashbeam trunks on the bank. Stay with a trunk until a log comes free. Cut two and bring them back.",
  progress: "The pile is still low. Two ashbeam logs, or the fire goes cold.",
  done: "That's the woodpile fed. Two logs. The camp fire will keep the watch. Crown's thanks.",
  gold: 12,
  need: 2,
  mobIds: [],
  gatherIds: ASHBEAM_LOG_SPAWNS,
  gatherYields: ["ashbeam-log"],
};

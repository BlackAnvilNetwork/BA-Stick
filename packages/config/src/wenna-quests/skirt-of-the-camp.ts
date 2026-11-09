import type { PaleHollowQuestDef } from "../pale-hollow-field";

export const SKIRT_HARE_IDS = [
  "ph-ember-hare-1",
  "ph-ember-hare-2",
  "ph-ember-hare-3",
  "ph-ember-hare-4",
  "ph-ember-hare-5",
  "ph-ember-hare-6",
] as const;

export const SKIRT_OF_THE_CAMP: PaleHollowQuestDef = {
  id: "ph-skirt",
  npcId: "npc-ph-herald",
  title: "Skirt of the Camp",
  kind: "kill",
  requires: "ph-wenna-emberwood",
  offer:
    "Hares are in the grass around Emberwatch. They sit in the skirt — scouts can't see past them. Bring down six of the nearest.",
  progress: "The grass around Emberwatch is still full of hares.",
  done: "That's the skirt clear. Scouts can see from Emberwatch now.",
  gold: 25,
  need: 6,
  mobIds: SKIRT_HARE_IDS,
};

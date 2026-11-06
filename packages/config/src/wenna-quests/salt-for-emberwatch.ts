import type { PaleHollowQuestDef } from "../pale-hollow-field";

export const SALT_FOR_EMBERWATCH: PaleHollowQuestDef = {
  id: "ph-wenna-tally",
  npcId: "npc-ph-herald",
  title: "Salt for Emberwatch",
  kind: "talk",
  requires: "ph-skirt",
  talkNpcId: "npc-ph-vendor",
  offer:
    "Emberwatch still eats. Follow the stream out of camp, over the Timber Bridge, through the Scout Gate. Maudry Saltpenny keeps Tally Row. She keeps two sets of scales — the Crown's, and the honest. Use the honest pair.",
  progress: "Maudry has not heard from Emberwatch.",
  done: "She'll send salt on the honest pair. That's how Emberwatch stays a camp.",
  gold: 20,
  need: 1,
  mobIds: [],
};

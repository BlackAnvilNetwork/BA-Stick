import { THIN_WATCH } from "./wenna-quests/thin-watch";
import { LOW_PILE } from "./wenna-quests/low-pile";
import { SKIRT_OF_THE_CAMP } from "./wenna-quests/skirt-of-the-camp";
import { SALT_FOR_EMBERWATCH } from "./wenna-quests/salt-for-emberwatch";
import { MORNING_CHAPTER } from "./wenna-quests/morning-chapter";
import type { PaleHollowQuestDef } from "./pale-hollow-field";

/** Wenna Gatesmoke's Emberwatch chain: one offered, the next after turn-in. */
export const WENNA_QUESTS: readonly PaleHollowQuestDef[] = [
  THIN_WATCH,
  LOW_PILE,
  SKIRT_OF_THE_CAMP,
  SALT_FOR_EMBERWATCH,
  MORNING_CHAPTER,
];

export const WENNA_NPC_ID = "npc-ph-herald" as const;

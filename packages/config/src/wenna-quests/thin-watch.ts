import type { PaleHollowQuestDef } from "../pale-hollow-field";
import { PH_START_CAMP } from "../pale-hollow-camp";

/** Timber lookout east of the Emberwatch fire (`startCampProps`). */
export const EMBERWATCH_LOOKOUT = {
  x: PH_START_CAMP.x + 9,
  z: PH_START_CAMP.z - 7,
} as const;

export const THIN_WATCH: PaleHollowQuestDef = {
  id: "ph-wenna-watch",
  npcId: "npc-ph-herald",
  title: "The Thin Watch",
  kind: "fetch",
  offer:
    "Mind the smoke. The timber lookout is the tall stand by the fire — four posts, a platform, a banner on top. Walk up to it and look the ridge from there. If the smoke is thin, the watch holds.",
  progress:
    "Walk up to the timber lookout by the fire. Four posts, a platform, a banner. Stand under it, then come back.",
  done: "Thin smoke. Good. Crown's news can wait till morning.",
  gold: 8,
  need: 1,
  mobIds: [],
  sites: [
    {
      id: "emberwatch-lookout",
      name: "Emberwatch lookout",
      x: EMBERWATCH_LOOKOUT.x,
      z: EMBERWATCH_LOOKOUT.z,
      r: 6,
      line: "Four posts, a platform, a banner. From the timber stand the ridge is a thin thread of smoke. Emberwatch holds.",
    },
  ],
};

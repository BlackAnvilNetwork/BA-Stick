/** Black Anvil jobs — seven live plus Druid (append-only; Gnosis setStartingJob 0–7). */

export const JOB_IDS = [
  "time_mage",
  "knight",
  "rogue",
  "cleric",
  "sorcerer",
  "fighter",
  "battle_mage",
  "druid",
] as const;

export type JobId = (typeof JOB_IDS)[number];

export type JobDef = {
  id: JobId;
  name: string;
  /** If false, Job Master shows it as coming soon. */
  playable: boolean;
  blurb: string;
};

export const JOBS: Record<JobId, JobDef> = {
  time_mage: {
    id: "time_mage",
    name: "Time Mage",
    playable: true,
    blurb: "Tempo, Flux, and chronomancy — haste the party, enfeeble the hall.",
  },
  knight: {
    id: "knight",
    name: "Knight",
    playable: true,
    blurb: "Shield tank — Provoke, Flash, Bulwark. Hold the line.",
  },
  rogue: {
    id: "rogue",
    name: "Rogue",
    playable: true,
    blurb: "Ghost Step to slip blows; Backblade for crit openers — violet smoke and daggers.",
  },
  cleric: {
    id: "cleric",
    name: "Cleric",
    playable: true,
    blurb: "Sacred Mercy, Ashmend, and Sunrise Recall — white light and sky-blue wards.",
  },
  sorcerer: {
    id: "sorcerer",
    name: "Sorcerer",
    playable: true,
    blurb: "Violet neve and elemental lances — stand back and burn with Arcane Flood.",
  },
  fighter: {
    id: "fighter",
    name: "Fighter",
    playable: true,
    blurb: "Two-hander physical DPS — Berserk, Killing Storm, Warcry. Iron and oxblood.",
  },
  battle_mage: {
    id: "battle_mage",
    name: "Battle Mage",
    playable: true,
    blurb: "Hybrid blade and en-spells — teal runes between casts, Refresh support.",
  },
  druid: {
    id: "druid",
    name: "Druid",
    playable: true,
    blurb: "Ring-Walker — Stick Bear, Stick Deer, Stick Lion, Racerunner. One borrowed song at a time.",
  },
};

export function isJobId(v: string): v is JobId {
  return (JOB_IDS as readonly string[]).includes(v);
}

/** Playable jobs the factory will mint. Missing allow-list → every playable job. */
export function mintableStartingJobs(startingJobs?: readonly number[] | null): JobId[] {
  const playable = JOB_IDS.filter((id) => JOBS[id].playable);
  if (!startingJobs || startingJobs.length === 0) return playable;
  const allowed = new Set(startingJobs);
  return playable.filter((id) => allowed.has(JOB_IDS.indexOf(id)));
}

/** Melee swing SFX family — staff casters vs blade jobs. */
export type JobWeapon = "staff" | "sword";

export const JOB_WEAPON: Record<JobId, JobWeapon> = {
  time_mage: "staff",
  cleric: "staff",
  sorcerer: "staff",
  knight: "sword",
  rogue: "sword",
  fighter: "sword",
  battle_mage: "sword",
  druid: "staff",
};

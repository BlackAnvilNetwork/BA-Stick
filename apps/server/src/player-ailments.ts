/**
 * Player ailments that Cleric -na and Erase remove.
 * Field casters apply one of these when a magic hit lands.
 */
export type AilmentKind = "poison" | "para" | "blind" | "silence" | "disease" | "petrify" | "curse";

export type AilmentHost = {
  poisonUntil: number;
  poisonTick: number;
  paraUntil: number;
  blindUntil: number;
  silenceUntil: number;
  diseaseUntil: number;
  petrifyUntil: number;
  curseUntil: number;
};

export type MobAilment = {
  kind: AilmentKind;
  durationMs: number;
  chance: number;
  poisonTick?: number;
};

const LABELS: Record<AilmentKind, string> = {
  poison: "poisoned",
  para: "paralyzed",
  blind: "blinded",
  silence: "silenced",
  disease: "diseased",
  petrify: "petrified",
  curse: "cursed",
};

export function emptyAilments(): AilmentHost {
  return {
    poisonUntil: 0,
    poisonTick: 0,
    paraUntil: 0,
    blindUntil: 0,
    silenceUntil: 0,
    diseaseUntil: 0,
    petrifyUntil: 0,
    curseUntil: 0,
  };
}

export function ailmentLabel(kind: AilmentKind): string {
  return LABELS[kind];
}

function untilKey(kind: AilmentKind): keyof AilmentHost {
  switch (kind) {
    case "poison":
      return "poisonUntil";
    case "para":
      return "paraUntil";
    case "blind":
      return "blindUntil";
    case "silence":
      return "silenceUntil";
    case "disease":
      return "diseaseUntil";
    case "petrify":
      return "petrifyUntil";
    case "curse":
      return "curseUntil";
  }
}

export function applyAilment(
  host: AilmentHost,
  kind: AilmentKind,
  now: number,
  durationMs: number,
  poisonTick = 0,
): void {
  const key = untilKey(kind);
  host[key] = Math.max(host[key], now + Math.max(0, durationMs));
  if (kind === "poison" && poisonTick > 0) host.poisonTick = Math.max(host.poisonTick, poisonTick);
}

export function activeAilments(host: AilmentHost, now: number, only?: readonly AilmentKind[]): AilmentKind[] {
  const kinds: AilmentKind[] = only
    ? [...only]
    : ["poison", "para", "blind", "silence", "disease", "petrify", "curse"];
  return kinds.filter((kind) => host[untilKey(kind)] > now);
}

/** Clear the named ailments that are still active. Returns the ones removed. */
export function clearAilments(host: AilmentHost, now: number, only?: readonly AilmentKind[]): AilmentKind[] {
  const active = activeAilments(host, now, only);
  for (const kind of active) {
    host[untilKey(kind)] = 0;
    if (kind === "poison") host.poisonTick = 0;
  }
  return active;
}

/** Which -na spell removes which ailment. Erase is every ailment. */
export function naTargets(id: string): readonly AilmentKind[] | null {
  switch (id) {
    case "cl_poisona":
      return ["poison"];
    case "cl_paralyna":
      return ["para"];
    case "cl_blindna":
      return ["blind"];
    case "cl_silena":
      return ["silence"];
    case "cl_viruna":
      return ["disease"];
    case "cl_stona":
      return ["petrify"];
    case "cl_cursna":
      return ["curse"];
    case "cl_erase":
      return ["poison", "para", "blind", "silence", "disease", "petrify", "curse"];
    default:
      return null;
  }
}

/**
 * Magic hit rider for a mob job.
 * Shiny casters carry the rarer ailments so Stona, Cursna, and Viruna have a source.
 */
export function mobBoltAilment(job: string, shiny: boolean): MobAilment | null {
  if (shiny && job === "sorcerer") return { kind: "disease", durationMs: 20_000, chance: 0.3 };
  if (shiny && job === "cleric") return { kind: "curse", durationMs: 16_000, chance: 0.25 };
  if (shiny && job === "time_mage") return { kind: "petrify", durationMs: 4_000, chance: 0.15 };
  switch (job) {
    case "sorcerer":
      return { kind: "poison", durationMs: 12_000, chance: 0.4, poisonTick: 3 };
    case "cleric":
      return { kind: "para", durationMs: 8_000, chance: 0.35 };
    case "time_mage":
      return { kind: "silence", durationMs: 10_000, chance: 0.35 };
    case "battle_mage":
      return { kind: "blind", durationMs: 8_000, chance: 0.35 };
    default:
      return null;
  }
}

/** Disease halves a cure. A zero heal stays zero. */
export function diseasedHeal(amount: number, diseaseUntil: number, now: number): number {
  if (!(diseaseUntil > now) || amount <= 0) return amount;
  return Math.floor(amount * 0.5);
}

/** Curse adds 15% to damage that already got through mitigation. */
export function curseTaken(dmg: number, curseUntil: number, now: number): number {
  if (!(curseUntil > now) || dmg <= 0) return dmg;
  return Math.max(1, Math.floor(dmg * 1.15));
}

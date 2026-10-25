import type { SnapshotMessage } from "@bellgrave/protocol";

/** Stable string for inventory, mats, skills, and gold — avoids recomputing recipes every snapshot tick. */
export function craftPanelDataSig(you: SnapshotMessage["you"]): string {
  const invParts: string[] = [];
  for (const i of you.inventory) {
    invParts.push(`${i.tokenId}:${i.amount}${i.starter ? "s" : ""}${i.hq ? "h" : ""}`);
  }
  invParts.sort();
  const mats = you.baseMats ?? {};
  const matKeys = Object.keys(mats).sort();
  const matParts = matKeys.map((k) => `${k}:${mats[k]}`);
  const skills = you.craftSkills ?? {};
  const skillKeys = (Object.keys(skills) as (keyof typeof skills)[]).sort();
  const skillParts = skillKeys.map((k) => {
    const row = skills[k];
    return `${String(k)}:${row?.level ?? 0}:${row?.xp ?? 0}`;
  });
  return [invParts.join(","), matParts.join(","), skillParts.join(","), you.lok?.gold ?? "0"].join("|");
}

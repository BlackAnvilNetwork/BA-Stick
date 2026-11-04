/** First unlocked id in each line. Lines are best-first; lower tiers stay in the spellbook. */
export function pickHotbarLines<T extends string>(
  unlocked: readonly T[],
  lines: readonly (readonly T[])[],
): T[] {
  const set = new Set(unlocked);
  const out: T[] = [];
  for (const line of lines) {
    for (const id of line) {
      if (id === "rest" || !set.has(id)) continue;
      out.push(id);
      break;
    }
  }
  return out;
}

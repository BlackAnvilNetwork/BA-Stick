/** Who may use Forest Basin map-builder spells (spellbook grants). */
export function isMapBuilderPlayer(p: { wallet: string; charId: string; name: string }): boolean {
  if (process.env.MAP_BUILDER_DEV === "1") return true;
  const wallets = (process.env.MAP_BUILDER_WALLETS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (wallets.includes(p.wallet.toLowerCase())) return true;
  const chars = (process.env.MAP_BUILDER_CHAR_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (chars.includes(p.charId)) return true;
  const names = (process.env.MAP_BUILDER_NAMES ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (names.includes(p.name.toLowerCase())) return true;
  return false;
}

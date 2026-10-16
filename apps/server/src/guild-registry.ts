/**
 * Local guild registry. One bonded operator, one guild.
 *
 * The bond is the one that operator already posted to join the voting set.
 * This module does not invent a bond amount, a minimum, or a fee. Joining
 * is free. A second Mark for the same operator does not open a second guild.
 *
 * There is no payout. `AhEscrow` `FEE_BPS` stays 100. Nothing here sends
 * xDAI or broadcasts to Gnosis or Chiado.
 *
 * A Mark grants no damage, loot, or combat advantage. Validators, light
 * clients, phones, and the listing key are not bonded operators. The Gnosis
 * Safe stays admin. The commit threshold is unchanged. Opening and joining
 * do not wait on the 20 Hz tick.
 */
import { votingReplica } from "./bonded-admission";
import { PINNED_GNOSIS_LISTING_ADDRESS } from "./production-boot";
import { postedSlashableBond } from "./root-anchor";

export type Guild = {
  id: string;
  operatorId: string;
  markId: string;
  /** Wei already posted for this operator. Not a fee and not a minimum. */
  bondWei: bigint;
};

export type OpenGuildResult = {
  opened: boolean;
  guild: Guild | null;
};

export type JoinGuildResult = {
  joined: boolean;
  /** Joining is free. */
  feeWei: 0n;
};

export type GuildMember = {
  characterId: string;
  feeWei: 0n;
};

const guildsByOperator = new Map<string, Guild>();
const guildsById = new Map<string, Guild>();
/** Mark id → the operator whose one guild that Mark belongs to. */
const markOperator = new Map<string, string>();
const members = new Map<string, Map<string, GuildMember>>();

export function resetGuildRegistryForTests(): void {
  guildsByOperator.clear();
  guildsById.clear();
  markOperator.clear();
  members.clear();
}

function notOpened(): OpenGuildResult {
  return { opened: false, guild: null };
}

function copyGuild(guild: Guild): Guild {
  return {
    id: guild.id,
    operatorId: guild.operatorId,
    markId: guild.markId,
    bondWei: guild.bondWei,
  };
}

function isListingKey(id: string): boolean {
  const trimmed = id.trim().toLowerCase();
  const pinned = PINNED_GNOSIS_LISTING_ADDRESS.toLowerCase();
  return trimmed === pinned || trimmed === pinned.slice(2);
}

/**
 * Wei already posted for a replica that joined the voting set.
 * A validator, a light client, a phone, and the listing key are not bonded.
 * This does not post a bond and does not invent an amount.
 */
function bondedWei(id: string): bigint | null {
  if (!id || isListingKey(id)) return null;
  const replica = votingReplica(id);
  if (!replica) return null;
  const posted = postedSlashableBond(id);
  if (posted <= 0n || posted !== replica.amountWei) return null;
  return posted;
}

export function guilds(): Guild[] {
  const listed: Guild[] = [];
  for (const guild of guildsByOperator.values()) listed.push(copyGuild(guild));
  return listed;
}

export function guildForOperator(operatorId: string): Guild | null {
  if (typeof operatorId !== "string") return null;
  const guild = guildsByOperator.get(operatorId.trim());
  return guild ? copyGuild(guild) : null;
}

export function guildMembers(guildId: string): GuildMember[] {
  if (typeof guildId !== "string") return [];
  const roster = members.get(guildId.trim());
  if (!roster) return [];
  const listed: GuildMember[] = [];
  for (const member of roster.values()) listed.push({ characterId: member.characterId, feeWei: 0n });
  return listed;
}

/**
 * Open the one guild for a bonded operator.
 * `operatorId` and `markId` must already be bonded replicas. The bond is
 * `postedSlashableBond(operatorId)`. A second Mark does not open another guild.
 */
export function openGuild(operatorId: string, markId: string): OpenGuildResult {
  if (typeof operatorId !== "string" || typeof markId !== "string") return notOpened();
  const operator = operatorId.trim();
  const mark = markId.trim();
  if (!operator || !mark) return notOpened();
  if (isListingKey(operator) || isListingKey(mark)) return notOpened();

  const existing = guildsByOperator.get(operator);
  if (existing) {
    const bound = markOperator.get(mark);
    if (!bound && bondedWei(mark) != null) markOperator.set(mark, operator);
    return { opened: false, guild: copyGuild(existing) };
  }

  const operatorClaim = markOperator.get(operator);
  if (operatorClaim && operatorClaim !== operator) return notOpened();
  const markClaim = markOperator.get(mark);
  if (markClaim && markClaim !== operator) return notOpened();

  const bondWei = bondedWei(operator);
  if (bondWei == null || bondedWei(mark) == null) return notOpened();

  const guild: Guild = {
    id: "guild:" + operator,
    operatorId: operator,
    markId: mark,
    bondWei,
  };
  guildsByOperator.set(operator, guild);
  guildsById.set(guild.id, guild);
  markOperator.set(operator, operator);
  markOperator.set(mark, operator);
  return { opened: true, guild: copyGuild(guild) };
}

/**
 * Join a guild that is already open. There is no fee and no bond.
 * Joining does not make the character a bonded operator and does not pay anyone.
 */
export function joinGuild(guildId: string, characterId: string): JoinGuildResult {
  if (typeof guildId !== "string" || typeof characterId !== "string") return { joined: false, feeWei: 0n };
  const id = guildId.trim();
  const character = characterId.trim();
  if (!id || !character || !guildsById.has(id)) return { joined: false, feeWei: 0n };
  let roster = members.get(id);
  if (!roster) {
    roster = new Map();
    members.set(id, roster);
  }
  roster.set(character, { characterId: character, feeWei: 0n });
  return { joined: true, feeWei: 0n };
}

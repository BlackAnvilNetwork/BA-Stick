/**
 * Local guild registry. One bonded operator, one guild.
 *
 * The bond is the one that operator already posted to join the voting set.
 * This module does not invent a bond amount, a minimum, or a fee. Joining
 * is a free request. That guild's bonded operator accepts before the
 * character is a member. The member does not accept themselves. A second
 * Mark for the same operator does not open a second guild.
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

export type GuildJoinRequest = {
  characterId: string;
  /** Joining is free. */
  feeWei: 0n;
};

export type JoinGuildResult = {
  /** True when an open request is recorded. Not membership. */
  requested: boolean;
  /** Joining is free. */
  feeWei: 0n;
};

export type AcceptGuildJoinResult = {
  accepted: boolean;
  /** Accepting is free. */
  feeWei: 0n;
};

/**
 * A vote a caller may attach. The registry does not read it.
 * Attaching one does not open a second guild, does not block a register,
 * and does not replace the Gnosis Safe.
 */
export type GuildBallot = {
  replaceSafe?: boolean;
  secondGuild?: boolean;
  blockRegister?: boolean;
  registryOwner?: string;
  slashingAdmin?: string;
  rulesetProposer?: string;
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
/** Open join requests. Not members, and not on the epoch roster. */
const requests = new Map<string, Map<string, GuildJoinRequest>>();

export function resetGuildRegistryForTests(): void {
  guildsByOperator.clear();
  guildsById.clear();
  markOperator.clear();
  members.clear();
  requests.clear();
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

/** Open requests only. Accepted members are not listed here. */
export function guildJoinRequests(guildId: string): GuildJoinRequest[] {
  if (typeof guildId !== "string") return [];
  const open = requests.get(guildId.trim());
  if (!open) return [];
  const listed: GuildJoinRequest[] = [];
  for (const request of open.values()) listed.push({ characterId: request.characterId, feeWei: 0n });
  return listed;
}

/**
 * Marks bound to the operator of this guild.
 * The registered Mark is included. A second Mark is the same guild.
 */
export function guildMarkIds(guildId: string): string[] {
  if (typeof guildId !== "string") return [];
  const guild = guildsById.get(guildId.trim());
  if (!guild) return [];
  const ids = new Set<string>();
  ids.add(guild.markId);
  for (const [mark, operator] of markOperator) {
    if (operator === guild.operatorId) ids.add(mark);
  }
  return [...ids];
}

/**
 * Open the one guild for a bonded operator.
 * `operatorId` and `markId` must already be bonded replicas. The bond is
 * `postedSlashableBond(operatorId)`. A second Mark does not open another guild.
 * `ballot` is ignored.
 */
export function openGuild(operatorId: string, markId: string, ballot?: GuildBallot): OpenGuildResult {
  void ballot;
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
 * Ask to join a guild that is already open. There is no fee and no bond.
 * The request does not check hardware or the replica flag, does not make the
 * character a bonded operator, and does not pay anyone. An open request is
 * not a member.
 */
export function joinGuild(guildId: string, characterId: string): JoinGuildResult {
  const refused: JoinGuildResult = { requested: false, feeWei: 0n };
  if (typeof guildId !== "string" || typeof characterId !== "string") return refused;
  const id = guildId.trim();
  const character = characterId.trim();
  if (!id || !character || !guildsById.has(id)) return refused;
  if (members.get(id)?.has(character)) return refused;
  let open = requests.get(id);
  if (!open) {
    open = new Map();
    requests.set(id, open);
  }
  open.set(character, { characterId: character, feeWei: 0n });
  return { requested: true, feeWei: 0n };
}

/**
 * Accept an open join request. The actor must be that guild's bonded
 * operator. The member does not accept themselves. Accepting is free, does
 * not check the member's hardware, and does not pay anyone. Only this step
 * writes `guildMembers`.
 */
export function acceptGuildJoin(guildId: string, characterId: string, operatorId: string): AcceptGuildJoinResult {
  const refused: AcceptGuildJoinResult = { accepted: false, feeWei: 0n };
  if (typeof guildId !== "string" || typeof characterId !== "string" || typeof operatorId !== "string") return refused;
  const id = guildId.trim();
  const character = characterId.trim();
  const operator = operatorId.trim();
  if (!id || !character || !operator) return refused;
  const guild = guildsById.get(id);
  if (!guild || operator !== guild.operatorId) return refused;
  if (character === operator) return refused;
  if (bondedWei(operator) == null) return refused;
  const open = requests.get(id);
  if (!open?.has(character)) return refused;
  open.delete(character);
  if (open.size === 0) requests.delete(id);
  let roster = members.get(id);
  if (!roster) {
    roster = new Map();
    members.set(id, roster);
  }
  roster.set(character, { characterId: character, feeWei: 0n });
  return { accepted: true, feeWei: 0n };
}

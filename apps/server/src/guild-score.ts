/**
 * Guild score and the xDAI payout gate.
 *
 * A guild's score for an epoch is a pure function of the certified journal
 * and that epoch's guild membership. It counts distinct characters in the
 * guild who have qualifying events in 10 different 10-second slices of that
 * hour. Qualifying events are a combat resolution, a gather, a craft, or a
 * trade the journal committed. One slice does not count, and actions in the
 * same 10 seconds are one slice. Each character contributes at most one.
 * Provisional batches do not score. The vault settles once per hour. The pot
 * is that hour's auction fees. A quiet hour does not pay, and its fees are
 * not paid out by a later hour.
 *
 * The Mark must have signed a commit certificate in that epoch or the guild
 * is ineligible. That signature is a bit, not a multiplier. A second Mark
 * does not multiply the score. Idle uptime does not pay.
 *
 * The player-facing auction fee is 5% (`AhEscrow` `FEE_BPS = 500`). A fill
 * credits the same floor split the contract sends: 250 bps of the sale to the
 * guild vault and 250 bps to the treasury (`ahGuildFeeShares`). That is the
 * existing fee, not a second fee and not a new token. A share change waits
 * the one-day ruleset timelock in the contract.
 *
 * A payout runs only after that epoch's certified root is anchored and the
 * one-day challenge delay (`CHALLENGE_DELAY_MS`, 86_400_000 ms) has passed.
 * That delay is not `PvpBounty` `claimDelay`. Guilds are paid in proportion
 * to that hour's scores. If every score is 0, that hour's xDAI stays in the vault.
 *
 * Of a guild's earned wei, the Mark Safe receives `earned / 2`. The remainder
 * is split equally across that epoch's accepted members, at the Guild Wallet
 * address predicted when they were accepted. Each share is floored. Leftover
 * wei stays in the vault. A request that was not accepted is not paid. A
 * member who has not deployed yet is still paid at the predicted address.
 * Nothing here broadcasts, and the tick does not wait.
 */
import { AH_FEE_BPS, AH_TREASURY_FEE_BPS, AH_VAULT_FEE_BPS, ahGuildFeeShares } from "@bellgrave/protocol";
import { getAddress, isAddress } from "viem";
import { guildMarkIds, guildMarkSafe, guildMembers, guilds } from "./guild-registry";
import { guildWallet } from "./guild-safes";
import { ANCHOR_WAIT, CHALLENGE_DELAY_MS, CHALLENGE_WAIT, EPOCH_MS, anchoredAtMs } from "./root-anchor";

export { CHALLENGE_DELAY_MS, EPOCH_MS };

/** One guild epoch. The vault settles on this clock, not the 10-second seed epoch. */
export const GUILD_EPOCH_MS = 60 * 60 * 1000;

/** Distinct 10-second slices a character needs in one guild hour before they count. */
export const ACTIVE_SLICES_REQUIRED = 10;

/** Guild hour containing `atMs`. Hours since the unix epoch. */
export function guildHour(atMs: number): number {
  if (!Number.isFinite(atMs)) return 0;
  return Math.floor(atMs / GUILD_EPOCH_MS);
}

/** 250 bps of the sale. Half of the 5% auction fee. */
export const GUILD_VAULT_BPS = AH_VAULT_FEE_BPS;

/** The other 250 bps of the sale. The treasury side of the same 5% fee. */
export const TREASURY_BPS = AH_TREASURY_FEE_BPS;

export type QualifyingKind = "combat" | "gather" | "craft" | "trade";

export type JournalEvent = {
  characterId: string;
  kind: string;
  /** When the action happened. The 10-second slice is `floor(atMs / EPOCH_MS)`. */
  atMs?: number;
};

export type JournalBatch = {
  epoch: number;
  /** True only when a commit certificate covers this batch. */
  certified: boolean;
  events: readonly JournalEvent[];
  /** Replica ids that signed this batch's commit certificate. */
  signers: readonly string[];
};

export type EpochMembership = {
  guildId: string;
  /** Any one of these Marks signing sets the bit. More than one does not multiply. */
  markIds: readonly string[];
  characterIds: readonly string[];
};

export type GuildScore = {
  guildId: string;
  score: number;
  /** False when no Mark of this guild signed a certified commit in the epoch. */
  eligible: boolean;
};

export type GuildPayment = {
  guildId: string;
  wei: bigint;
};

export type GuildShare = {
  guildId: string;
  to: `0x${string}`;
  role: "mark" | "member";
  wei: bigint;
};

export type GuildPayoutResult = {
  ok: boolean;
  error?: string;
  vaultWei: bigint;
  /** Each scoring guild's earned wei, before the Mark and member split. */
  paid: GuildPayment[];
  /** Mark Safe and Guild Wallet amounts. Dust is not listed. */
  shares: GuildShare[];
};

type StoredBatch = {
  epoch: number;
  height: number;
  certified: boolean;
  events: JournalEvent[];
  signers: string[];
  membership: EpochMembership[];
};

const MAX_TRACKED_HEIGHTS = 4096;

type PayoutRoute = {
  mark: `0x${string}` | null;
  members: Map<string, `0x${string}`>;
};

const vaultByEpoch = new Map<number, bigint>();
let treasuryWei = 0n;
const batches: StoredBatch[] = [];
const heightEpoch = new Map<number, number>();
const certifiedHeight = new Map<number, number>();
const epochSigners = new Map<number, Set<string>>();
const membershipByEpoch = new Map<number, Map<string, { markIds: Set<string>; characterIds: Set<string> }>>();
const settledEpochs = new Set<number>();
/** Test stand-in for a predicted Safe. Production boot does not call the setter. */
const payoutRoutes = new Map<string, PayoutRoute>();

export function resetGuildScoreForTests(): void {
  vaultByEpoch.clear();
  treasuryWei = 0n;
  batches.length = 0;
  heightEpoch.clear();
  certifiedHeight.clear();
  epochSigners.clear();
  membershipByEpoch.clear();
  settledEpochs.clear();
  payoutRoutes.clear();
}

function asAddress(value: string | null | undefined): `0x${string}` | null {
  if (typeof value !== "string" || !isAddress(value)) return null;
  return getAddress(value);
}

/**
 * Stand in for a predicted Safe when accept did not predict one.
 * A Mark Safe or Guild Wallet address that already exists is paid instead.
 */
export function setGuildPayoutRouteForTests(
  guildId: string,
  route: { mark: string | null; members: readonly { characterId: string; address: string }[] },
): void {
  if (typeof guildId !== "string" || !guildId.trim()) return;
  const members = new Map<string, `0x${string}`>();
  for (const member of route.members) {
    const id = member.characterId.trim().toLowerCase();
    const address = asAddress(member.address);
    if (!id || !address) continue;
    members.set(id, address);
  }
  payoutRoutes.set(guildId.trim(), { mark: asAddress(route.mark), members });
}

export function guildVaultWei(): bigint {
  let total = 0n;
  for (const wei of vaultByEpoch.values()) total += wei;
  return total;
}

export function guildTreasuryWei(): bigint {
  return treasuryWei;
}

function sameId(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function qualifyingKind(kind: string): QualifyingKind | null {
  switch (kind) {
    case "combat":
    case "pvpKill":
      return "combat";
    case "gather":
    case "harvest":
      return "gather";
    case "craft":
      return "craft";
    case "trade":
    case "chainFill":
    case "buy":
    case "fill":
    case "settle":
      return "trade";
    default:
      return null;
  }
}

/**
 * 250 bps of `priceWei` to the guild vault and 250 bps to the treasury.
 * Both come out of the 5% fee, floored the same way `AhEscrow`
 * floors them. A rounding wei of that fee stays with the treasury.
 * The player-facing fee is unchanged.
 */
export function guildAuctionSplit(priceWei: bigint): { feeWei: bigint; vaultWei: bigint; treasuryWei: bigint } {
  if (AH_FEE_BPS !== GUILD_VAULT_BPS + TREASURY_BPS) {
    throw new Error("Guild vault and treasury must be the existing 5% fee.");
  }
  return ahGuildFeeShares(priceWei);
}

/**
 * Credit the guild share of one sale to that guild hour.
 * Does not pay a guild and does not broadcast. A later hour does not receive this wei.
 */
export function creditGuildVault(priceWei: bigint, epoch = 0): { vaultWei: bigint; treasuryWei: bigint } {
  const split = guildAuctionSplit(priceWei);
  vaultByEpoch.set(epoch, (vaultByEpoch.get(epoch) ?? 0n) + split.vaultWei);
  treasuryWei += split.treasuryWei;
  return split;
}

function pushEvent(
  events: JournalEvent[],
  token: unknown,
  kind: QualifyingKind,
  characterId: (tokenId: string) => string | null,
): void {
  if (typeof token !== "string") return;
  const trimmed = token.trim();
  if (!trimmed) return;
  const id = characterId(trimmed)?.trim() || trimmed;
  if (!id) return;
  events.push({ characterId: id, kind });
}

/**
 * Qualifying events in journal commands the world just committed.
 * Loot, gold, and level-ups are not qualifying.
 */
export function qualifyingEventsFromJournalCmds(
  cmds: readonly Record<string, unknown>[],
  characterId: (tokenId: string) => string | null,
): JournalEvent[] {
  const events: JournalEvent[] = [];
  for (const cmd of cmds) {
    const op = cmd.op;
    if (op === "harvest") pushEvent(events, cmd.tokenId, "gather", characterId);
    else if (op === "craft") pushEvent(events, cmd.tokenId, "craft", characterId);
    else if (op === "pvpKill" || op === "combat") pushEvent(events, cmd.slayer ?? cmd.tokenId, "combat", characterId);
    else if (op === "chainFill" || op === "buy" || op === "fill" || op === "settle" || op === "trade") {
      pushEvent(events, cmd.buyer ?? cmd.bidder ?? cmd.tokenId, "trade", characterId);
      pushEvent(events, cmd.seller, "trade", characterId);
    }
  }
  return events;
}

function copyMembership(rows: readonly EpochMembership[]): EpochMembership[] {
  return rows.map((row) => ({
    guildId: row.guildId,
    markIds: row.markIds.slice(),
    characterIds: row.characterIds.slice(),
  }));
}

/** Accepted members only. An open join request is not on this roster. */
function liveMembership(): EpochMembership[] {
  const rows: EpochMembership[] = [];
  for (const guild of guilds()) {
    rows.push({
      guildId: guild.id,
      markIds: guildMarkIds(guild.id),
      characterIds: guildMembers(guild.id).map((member) => member.characterId),
    });
  }
  return rows;
}

function rememberMembership(epoch: number, rows: readonly EpochMembership[]): void {
  let slot = membershipByEpoch.get(epoch);
  if (!slot) {
    slot = new Map();
    membershipByEpoch.set(epoch, slot);
  }
  for (const row of rows) {
    const found = slot.get(row.guildId) ?? { markIds: new Set<string>(), characterIds: new Set<string>() };
    for (const mark of row.markIds) {
      const trimmed = mark.trim();
      if (trimmed) found.markIds.add(trimmed);
    }
    for (const character of row.characterIds) {
      const trimmed = character.trim();
      if (trimmed) found.characterIds.add(trimmed);
    }
    slot.set(row.guildId, found);
  }
}

/** Membership recorded when this epoch's batches were noted. A later accept is a later epoch. */
function membershipRows(epoch: number): EpochMembership[] {
  const slot = membershipByEpoch.get(epoch);
  if (!slot) return [];
  const rows: EpochMembership[] = [];
  for (const [guildId, row] of slot) {
    rows.push({ guildId, markIds: [...row.markIds], characterIds: [...row.characterIds] });
  }
  return rows;
}

function rememberHeight(epoch: number, height: number): void {
  if (height < 0) return;
  heightEpoch.set(height, epoch);
  if (heightEpoch.size <= MAX_TRACKED_HEIGHTS) return;
  for (const tracked of heightEpoch.keys()) {
    const pending = batches.some((batch) => batch.height === tracked && !batch.certified);
    if (pending) continue;
    heightEpoch.delete(tracked);
    if (heightEpoch.size <= MAX_TRACKED_HEIGHTS) break;
  }
}

function noteCertifiedHeight(epoch: number, height: number): void {
  const prev = certifiedHeight.get(epoch) ?? -1;
  if (height > prev) certifiedHeight.set(epoch, height);
}

/**
 * Record one tick's journal events as a provisional batch.
 * A later commit certificate is what certifies them. Empty events still
 * record the height so a signature on that tick can count.
 */
export function noteGuildBatch(args: { epoch: number; height: number; events: readonly JournalEvent[] }): void {
  if (!Number.isInteger(args.epoch)) return;
  const roster = liveMembership();
  rememberMembership(args.epoch, roster);
  if (args.height >= 0) rememberHeight(args.epoch, args.height);
  if (args.events.length === 0) return;
  const events = args.events.map((event) => ({
    characterId: event.characterId,
    kind: event.kind,
    ...(typeof event.atMs === "number" && Number.isFinite(event.atMs) ? { atMs: event.atMs } : {}),
  }));
  const existing = batches.find((batch) => batch.epoch === args.epoch && batch.height === args.height);
  if (existing) {
    if (!existing.certified) {
      existing.events = events;
      existing.membership = copyMembership(roster);
    }
    return;
  }
  batches.push({
    epoch: args.epoch,
    height: args.height,
    certified: false,
    events,
    signers: [],
    membership: copyMembership(roster),
  });
}

/**
 * Signer addresses inside a lok-order commit certificate.
 * Layout: height u64 LE, round i64 LE, 32-byte root, count u32 LE,
 * then each signer as a 32-byte address and a 64-byte signature.
 */
export function commitCertificateSigners(certificate: Uint8Array): string[] {
  if (!(certificate instanceof Uint8Array) || certificate.length < 52) return [];
  const copy = new Uint8Array(certificate);
  const view = new DataView(copy.buffer);
  const count = view.getUint32(48, true);
  if (count < 1 || count > 10_000) return [];
  const signers: string[] = [];
  let offset = 52;
  for (let i = 0; i < count; i += 1) {
    if (offset + 96 > copy.length) break;
    signers.push(Buffer.from(copy.subarray(offset, offset + 32)).toString("hex"));
    offset += 96;
  }
  return signers;
}

/** Mark the batch at `height` certified and record who signed it. */
export function certifyGuildBatch(height: number, certificate: Uint8Array): void {
  if (!Number.isInteger(height) || height < 0) return;
  const signers = commitCertificateSigners(certificate);
  if (signers.length === 0) return;
  let epoch = heightEpoch.get(height) ?? null;
  for (const batch of batches) {
    if (batch.height !== height) continue;
    batch.certified = true;
    batch.signers = signers.slice();
    epoch = batch.epoch;
  }
  if (epoch == null) return;
  noteCertifiedHeight(epoch, height);
  const signed = epochSigners.get(epoch) ?? new Set<string>();
  for (const signer of signers) signed.add(signer);
  epochSigners.set(epoch, signed);
  heightEpoch.delete(height);
}

function journalFor(epoch: number): JournalBatch[] {
  const rows: JournalBatch[] = [];
  for (const batch of batches) {
    if (batch.epoch !== epoch) continue;
    rows.push({
      epoch: batch.epoch,
      certified: batch.certified,
      events: batch.events.map((event) => ({
        characterId: event.characterId,
        kind: event.kind,
        ...(typeof event.atMs === "number" ? { atMs: event.atMs } : {}),
      })),
      signers: batch.signers.slice(),
    });
  }
  const signed = epochSigners.get(epoch);
  if (signed && signed.size > 0) {
    rows.push({ epoch, certified: true, events: [], signers: [...signed] });
  }
  return rows;
}

function epochAnchoredAt(epoch: number): number | null {
  const height = certifiedHeight.get(epoch);
  if (height == null || height < 0) return null;
  return anchoredAtMs(height);
}

/**
 * Score one guild hour. Provisional batches are ignored. A character counts
 * once, and only after qualifying actions in 10 different 10-second slices.
 * No Mark signature yields an ineligible guild and a score of 0.
 */
export function guildScore(
  journal: readonly JournalBatch[],
  epoch: number,
  membership: readonly EpochMembership[],
): GuildScore[] {
  const certified = journal.filter((batch) => batch.epoch === epoch && batch.certified);
  const signers: string[] = [];
  for (const batch of certified) {
    for (const signer of batch.signers) signers.push(signer);
  }
  const scores: GuildScore[] = [];
  for (const guild of membership) {
    const eligible = guild.markIds.some((mark) => signers.some((signer) => sameId(mark, signer)));
    if (!eligible) {
      scores.push({ guildId: guild.guildId, score: 0, eligible: false });
      continue;
    }
    const slicesByCharacter = new Map<string, Set<number>>();
    for (const batch of certified) {
      for (const event of batch.events) {
        if (!qualifyingKind(event.kind)) continue;
        const character = event.characterId.trim().toLowerCase();
        if (!character) continue;
        if (!guild.characterIds.some((member) => sameId(member, character))) continue;
        const slice = typeof event.atMs === "number" && Number.isFinite(event.atMs) ? Math.floor(event.atMs / EPOCH_MS) : 0;
        const slices = slicesByCharacter.get(character) ?? new Set<number>();
        slices.add(slice);
        slicesByCharacter.set(character, slices);
      }
    }
    let active = 0;
    for (const slices of slicesByCharacter.values()) {
      if (slices.size >= ACTIVE_SLICES_REQUIRED) active += 1;
    }
    scores.push({ guildId: guild.guildId, score: active, eligible: true });
  }
  return scores;
}

/**
 * Pay the vault in proportion to scores.
 * Refuses until the epoch root is anchored and the one-day delay has passed.
 * A zero total leaves `vaultWei` unchanged.
 */
export function guildPayout(args: {
  vaultWei: bigint;
  scores: readonly { guildId: string; score: number }[];
  anchoredAtMs: number | null;
  nowMs: number;
}): GuildPayoutResult {
  const held = args.vaultWei;
  if (held < 0n || args.anchoredAtMs == null || !Number.isFinite(args.anchoredAtMs)) {
    return { ok: false, error: ANCHOR_WAIT, vaultWei: held, paid: [], shares: [] };
  }
  if (!Number.isFinite(args.nowMs) || args.nowMs - args.anchoredAtMs < CHALLENGE_DELAY_MS) {
    return { ok: false, error: CHALLENGE_WAIT, vaultWei: held, paid: [], shares: [] };
  }
  let total = 0;
  for (const row of args.scores) {
    if (row.score > 0) total += row.score;
  }
  if (total === 0) return { ok: true, vaultWei: held, paid: [], shares: [] };
  const totalScore = BigInt(total);
  const paid: GuildPayment[] = [];
  let spent = 0n;
  for (const row of args.scores) {
    if (row.score <= 0) continue;
    const wei = (held * BigInt(row.score)) / totalScore;
    if (wei <= 0n) continue;
    paid.push({ guildId: row.guildId, wei });
    spent += wei;
  }
  return { ok: true, vaultWei: held - spent, paid, shares: [] };
}

/**
 * Half of a guild's earning goes to its Mark Safe. The rest is split equally
 * across the accepted members' predicted Guild Wallet addresses. Floors.
 * Wei with no address, and the flooring remainder, stay out of `shares`.
 */
export function splitGuildEarning(args: {
  guildId: string;
  earnedWei: bigint;
  mark: `0x${string}` | null;
  members: readonly { characterId: string; address: `0x${string}` | null }[];
}): { shares: GuildShare[]; dustWei: bigint } {
  if (args.earnedWei <= 0n) return { shares: [], dustWei: 0n };
  const shares: GuildShare[] = [];
  let sent = 0n;
  const markWei = args.earnedWei / 2n;
  if (args.mark && markWei > 0n) {
    shares.push({ guildId: args.guildId, to: args.mark, role: "mark", wei: markWei });
    sent += markWei;
  }
  const count = BigInt(args.members.length);
  const pool = args.earnedWei - markWei;
  const each = count > 0n ? pool / count : 0n;
  if (each > 0n) {
    for (const member of args.members) {
      if (!member.address) continue;
      shares.push({ guildId: args.guildId, to: member.address, role: "member", wei: each });
      sent += each;
    }
  }
  return { shares, dustWei: args.earnedWei - sent };
}

function routeAddress(guildId: string, characterId: string | null, mark: boolean): `0x${string}` | null {
  const predicted = mark ? guildMarkSafe(guildId) : characterId ? (guildWallet(guildId, characterId)?.address ?? null) : null;
  if (predicted) return predicted;
  const route = payoutRoutes.get(guildId);
  if (!route) return null;
  if (mark) return route.mark;
  if (!characterId) return null;
  return route.members.get(characterId.trim().toLowerCase()) ?? null;
}

function sharesFor(guildId: string, earnedWei: bigint, characterIds: readonly string[]): { shares: GuildShare[]; dustWei: bigint } {
  return splitGuildEarning({
    guildId,
    earnedWei,
    mark: routeAddress(guildId, null, true),
    members: characterIds.map((characterId) => ({
      characterId,
      address: routeAddress(guildId, characterId, false),
    })),
  });
}

/**
 * Score the epochs this process has noted and pay when the gate is open.
 * Synchronous. An epoch that is not ready yet stops the loop. Payouts already
 * taken for earlier hours stay paid. A zero score leaves that hour's fees
 * where they are. A refusal does not pay the hour that is still waiting.
 */
export function settleGuildPayouts(nowMs: number): GuildPayoutResult {
  const epochs = new Set<number>();
  for (const epoch of membershipByEpoch.keys()) epochs.add(epoch);
  for (const epoch of certifiedHeight.keys()) epochs.add(epoch);
  for (const batch of batches) epochs.add(batch.epoch);
  const ordered = [...epochs].sort((a, b) => a - b);
  let result: GuildPayoutResult = { ok: true, vaultWei: guildVaultWei(), paid: [], shares: [] };
  for (const epoch of ordered) {
    if (settledEpochs.has(epoch)) continue;
    const roster = membershipRows(epoch);
    const scores = guildScore(journalFor(epoch), epoch, roster);
    const decision = guildPayout({
      vaultWei: vaultByEpoch.get(epoch) ?? 0n,
      scores,
      anchoredAtMs: epochAnchoredAt(epoch),
      nowMs,
    });
    if (!decision.ok) {
      return { ...decision, vaultWei: guildVaultWei() };
    }
    if (decision.paid.length === 0) {
      result = { ...decision, vaultWei: guildVaultWei() };
      continue;
    }
    const shares: GuildShare[] = [];
    let dust = 0n;
    for (const payment of decision.paid) {
      const row = roster.find((guild) => guild.guildId === payment.guildId);
      const split = sharesFor(payment.guildId, payment.wei, row?.characterIds ?? []);
      shares.push(...split.shares);
      dust += split.dustWei;
    }
    const earned = decision.paid.reduce((sum, payment) => sum + payment.wei, 0n);
    const sent = earned - dust;
    if (sent <= 0n) {
      result = { ok: true, vaultWei: guildVaultWei(), paid: decision.paid, shares: [] };
      continue;
    }
    settledEpochs.add(epoch);
    const left = decision.vaultWei + dust;
    if (left === 0n) vaultByEpoch.delete(epoch);
    else vaultByEpoch.set(epoch, left);
    result = { ok: true, vaultWei: guildVaultWei(), paid: decision.paid, shares };
  }
  return result;
}

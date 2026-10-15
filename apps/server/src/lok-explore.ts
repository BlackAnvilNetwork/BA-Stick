import { abilityLabel, isAbilityId } from "@bellgrave/combat";
import { itemName } from "@bellgrave/items";
import type { LokEventView } from "@bellgrave/protocol";

const EXPLORE_DEFAULT = 40;
const EXPLORE_MAX = 80;

export type LokExplorePage = {
  events: LokEventView[];
  total: number;
  hasMore: boolean;
};

type RawInput = Record<string, unknown>;
type RawEntry = { seq: number; hash: string; input: RawInput };
type RawLog = { tokenId: string; entries: RawEntry[] };
type Built = LokEventView & { search: string };

export function exploreDocument(
  logText: string,
  nameOf: (tokenId: string) => string,
  opts: {
    tokenId: string | null;
    q?: string;
    limit?: number;
    beforeSeq?: number | null;
  },
): LokExplorePage {
  const logs = parseLogs(logText);
  const chosen = opts.tokenId == null ? logs : logs.filter((log) => log.tokenId === opts.tokenId);
  const seen = new Set<number>();
  const rows: Built[] = [];
  for (const log of chosen) {
    for (const entry of log.entries) {
      if (opts.tokenId == null) {
        if (seen.has(entry.seq)) continue;
        seen.add(entry.seq);
      }
      rows.push(describe(entry, log.tokenId, nameOf));
    }
  }
  const q = (opts.q ?? "").trim().toLowerCase();
  const filtered = q ? rows.filter((row) => row.search.includes(q)) : rows;
  filtered.sort((a, b) => b.seq - a.seq || a.hash.localeCompare(b.hash));
  const before = opts.beforeSeq;
  const windowed = before == null ? filtered : filtered.filter((row) => row.seq < before);
  const limit = clampLimit(opts.limit);
  const events = windowed.slice(0, limit).map(({ search: _search, ...row }) => row);
  return { events, total: filtered.length, hasMore: windowed.length > events.length };
}

function clampLimit(limit: number | undefined): number {
  if (limit == null || !Number.isFinite(limit)) return EXPLORE_DEFAULT;
  return Math.min(EXPLORE_MAX, Math.max(1, Math.floor(limit)));
}

function parseLogs(text: string): RawLog[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== "object") return [];
  const doc = parsed as { type?: unknown; characters?: unknown };
  if (doc.type !== "characters" || !Array.isArray(doc.characters)) return [];
  const logs: RawLog[] = [];
  for (const row of doc.characters) {
    if (!row || typeof row !== "object") continue;
    const tokenId = field(row as RawInput, "tokenId");
    const entriesRaw = (row as { entries?: unknown }).entries;
    if (!Array.isArray(entriesRaw)) continue;
    const entries: RawEntry[] = [];
    for (const entry of entriesRaw) {
      if (!entry || typeof entry !== "object") continue;
      const body = entry as { seq?: unknown; hash?: unknown; input?: unknown };
      if (typeof body.seq !== "number" || !Number.isFinite(body.seq)) continue;
      if (!body.input || typeof body.input !== "object") continue;
      entries.push({
        seq: body.seq,
        hash: typeof body.hash === "string" ? body.hash : "",
        input: body.input as RawInput,
      });
    }
    logs.push({ tokenId, entries });
  }
  return logs;
}

function describe(entry: RawEntry, logTokenId: string, nameOf: (tokenId: string) => string): Built {
  const input = entry.input;
  const kind = field(input, "type") || "event";
  const who = (id: string) => {
    if (!id) return "";
    return nameOf(id) || id;
  };
  const owner = who(logTokenId) || logTokenId || "Log";
  let character = owner;
  let text = `${owner} ${kind}`;
  const bits = [kind, owner, logTokenId, ...rawBits(input)];

  const token = field(input, "tokenId") || logTokenId;
  const amount = field(input, "amount");
  const itemId = field(input, "itemId");
  const item = itemId ? itemPhrase(itemId) : "";

  switch (kind) {
    case "spawn": {
      character = who(token) || owner;
      text = `${character} joined the log`;
      break;
    }
    // Historical log kinds. New appends are refused; these labels only describe an old entry.
    case "depositKek": {
      character = who(token) || owner;
      text = `${character} deposited ${amount} legacy KEK`;
      bits.push("kek", "legacy");
      break;
    }
    case "importItem": {
      character = who(token) || owner;
      text = `${character} imported ${item} x${amount}`;
      break;
    }
    case "exportItem": {
      character = who(token) || owner;
      text = `${character} exported ${item} x${amount}`;
      break;
    }
    case "withdrawKek": {
      character = who(token) || owner;
      text = `${character} withdrew ${amount} legacy KEK`;
      bits.push("kek", "legacy");
      break;
    }
    case "spendKek": {
      character = who(token) || owner;
      text = `${character} spent ${amount} legacy KEK`;
      bits.push("kek", "legacy");
      break;
    }
    case "goldEarn": {
      character = who(token) || owner;
      text = `${character} earned ${amount} gold (${field(input, "source") || "source"})`;
      bits.push("gold");
      break;
    }
    case "goldSpend": {
      character = who(token) || owner;
      text = `${character} spent ${amount} gold (${field(input, "sink") || "sink"})`;
      bits.push("gold");
      break;
    }
    case "goldSell": {
      character = who(token) || owner;
      text = `${character} sold ${item} x${field(input, "qty") || amount} for ${amount} gold`;
      bits.push("gold");
      break;
    }
    case "sendItem": {
      const from = field(input, "from");
      const to = field(input, "to");
      character = who(from) || from || owner;
      text = `${character} sent ${item} x${amount} to ${who(to) || to}`;
      bits.push(who(from), who(to));
      break;
    }
    case "sendKek": {
      const from = field(input, "from");
      const to = field(input, "to");
      character = who(from) || from || owner;
      text = `${character} sent ${amount} legacy KEK to ${who(to) || to}`;
      bits.push("kek", "legacy", who(from), who(to));
      break;
    }
    case "list": {
      const seller = field(input, "seller");
      character = who(seller) || seller || owner;
      text = `${character} listed ${item} x${amount} (#${field(input, "listingId")})`;
      bits.push(who(seller));
      break;
    }
    case "bid": {
      const bidder = field(input, "bidder");
      character = who(bidder) || bidder || owner;
      text = `${character} bid ${amount} legacy KEK on #${field(input, "listingId")}`;
      bits.push("kek", "legacy", who(bidder));
      break;
    }
    case "cancel": {
      const seller = field(input, "seller");
      character = who(seller) || seller || owner;
      text = `${character} cancelled listing #${field(input, "listingId")}`;
      bits.push(who(seller));
      break;
    }
    case "settle": {
      character = "Listing";
      text = `Listing #${field(input, "listingId")} settled`;
      break;
    }
    case "levelUp": {
      character = who(token) || owner;
      text = `${character} reached level ${field(input, "level")}`;
      break;
    }
    case "learnAbility": {
      character = who(token) || owner;
      const ability = abilityPhrase(field(input, "abilityId"));
      text = `${character} learned ${ability}`;
      bits.push(ability);
      break;
    }
    case "craft": {
      character = who(token) || owner;
      text = `${character} crafted ${item} x${amount}`;
      break;
    }
    case "harvest": {
      character = who(token) || owner;
      const material = field(input, "materialId");
      text = `${character} harvested ${material} x${amount}`;
      bits.push(material);
      break;
    }
    case "itemDrop": {
      // Historical entry: credited the stack onto the log. New appends are closed.
      character = who(token) || owner;
      text = `${character} looted ${item} x${amount}`;
      break;
    }
    case "lootDrop": {
      character = who(token) || owner;
      text = `${character} looted ${item} x${amount}`;
      break;
    }
    case "bagImport": {
      character = who(token) || owner;
      text = `${character} imported ${item} x${amount} from the bag`;
      break;
    }
    case "bagExport": {
      character = who(token) || owner;
      text = `${character} exported ${item} x${amount} to the bag`;
      break;
    }
    case "ask": {
      const seller = field(input, "seller");
      character = who(seller) || seller || owner;
      const minPrice = field(input, "minPrice");
      // Pre-economy asks stored KEK units; AhEscrow asks store wei (≥1 gwei).
      let priceLabel = minPrice + " wei ETH";
      try {
        if (minPrice && BigInt(minPrice) < 1_000_000_000n) priceLabel = minPrice + " legacy KEK";
      } catch {
        /* keep wei label */
      }
      text = `${character} asked ${priceLabel} for ${item} x${amount} (#${field(input, "listingId")})`;
      bits.push(who(seller), "legacy");
      break;
    }
    case "fill": {
      const bidder = field(input, "bidder");
      character = who(bidder) || bidder || owner;
      text = `${character} bought ${item} for ${amount} legacy KEK (#${field(input, "listingId")})`;
      bits.push("kek", "legacy", who(bidder));
      break;
    }
    case "cancelAsk":
    case "reclaimAsk": {
      const seller = field(input, "seller");
      character = who(seller) || seller || owner;
      text = `${character} returned listing #${field(input, "listingId")} to the inbox`;
      bits.push(who(seller));
      break;
    }
    case "sendInbox": {
      const from = field(input, "from");
      const to = field(input, "to");
      character = who(from) || from || owner;
      text = `${character} sent ${item} x${amount} to ${who(to) || to} (inbox)`;
      bits.push(who(from), who(to));
      break;
    }
    case "takeInbox": {
      character = who(token) || owner;
      text = `${character} took ${item} x${amount} from the inbox`;
      break;
    }
    case "craftSkill": {
      character = who(token) || owner;
      text = `${character} ${field(input, "skillId")} level ${field(input, "level")}`;
      break;
    }
    case "respecSkills": {
      character = who(token) || owner;
      text = `${character} respecced skills`;
      break;
    }
    case "paidRespecSkills": {
      character = who(token) || owner;
      text = `${character} paid a skill respec`;
      break;
    }
    default:
      break;
  }

  if (item) bits.push(item, itemId);
  bits.push(character, text);
  return {
    seq: entry.seq,
    hash: entry.hash,
    kind,
    character,
    text,
    search: bits.filter(Boolean).join(" ").toLowerCase(),
  };
}

function itemPhrase(id: string): string {
  if (!/^\d+$/.test(id)) return id;
  const n = Number(id);
  if (!Number.isSafeInteger(n)) return id;
  const named = itemName(n);
  if (!named || named === `#${n}`) return id;
  return `${named} (${id})`;
}

function abilityPhrase(id: string): string {
  if (!id) return "";
  if (!isAbilityId(id)) return id;
  const label = abilityLabel(id);
  return label && label !== id ? `${label} (${id})` : id;
}

function rawBits(input: RawInput): string[] {
  const out: string[] = [];
  for (const value of Object.values(input)) {
    if (typeof value === "string" || typeof value === "number") out.push(String(value));
  }
  return out;
}

function field(input: RawInput, key: string): string {
  const value = input[key];
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

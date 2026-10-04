import { getItem, type ItemKind } from "@bellgrave/items";
import {
  compareAsks,
  planQuantityFills,
  type AskQuote,
  type LokListingView,
  type QuantityPlan,
} from "@bellgrave/protocol";
import { useState } from "react";
import { send } from "./net";

const KINDS: ItemKind[] = ["base", "intermediate", "consumable", "equipment", "filler", "bait"];

function kindLabel(kind: ItemKind): string {
  switch (kind) {
    case "base":
      return "Materials";
    case "intermediate":
      return "Components";
    case "consumable":
      return "Consumables";
    case "equipment":
      return "Equipment";
    case "filler":
      return "Filler";
    case "bait":
      return "Bait";
  }
}

function itemName(tokenId: number): string {
  return getItem(tokenId)?.name ?? "Item " + tokenId;
}

function isCommodity(itemId: number): boolean {
  const def = getItem(itemId);
  return !def || def.kind !== "equipment";
}

function quoteOf(row: LokListingView): AskQuote {
  return {
    id: row.id,
    seller: row.seller,
    itemId: row.itemId,
    amount: row.amount,
    minPrice: row.minPrice,
    listedAt: row.listedAt,
    book: row.book,
  };
}

function matches(row: LokListingView, query: string, category: "all" | ItemKind): boolean {
  const def = getItem(row.itemId);
  if (category !== "all" && def?.kind !== category) return false;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [itemName(row.itemId), def?.kind ?? "", def?.slot ?? "", row.sellerName, String(row.itemId)]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

type StackLine = {
  key: string;
  mode: "stack";
  itemId: number;
  total: string;
  lowest: string;
  lowestYours: boolean;
  rows: LokListingView[];
};

type SingleLine = { key: string; mode: "row"; row: LokListingView };

export type AuctionLine = StackLine | SingleLine;

export function auctionLines(listings: LokListingView[], query: string, category: "all" | ItemKind): AuctionLine[] {
  const groups = new Map<number, LokListingView[]>();
  const singles: LokListingView[] = [];
  for (const row of listings) {
    if (!matches(row, query, category)) continue;
    if (row.book && isCommodity(row.itemId)) {
      const list = groups.get(row.itemId) ?? [];
      list.push(row);
      groups.set(row.itemId, list);
    } else {
      singles.push(row);
    }
  }
  const lines: AuctionLine[] = [];
  for (const [itemId, rows] of groups) {
    const ordered = rows.slice().sort((a, b) => compareAsks(quoteOf(a), quoteOf(b)));
    let total = 0n;
    for (const row of ordered) {
      if (/^\d+$/.test(row.amount)) total += BigInt(row.amount);
    }
    const low = ordered[0];
    lines.push({
      key: "item-" + itemId,
      mode: "stack",
      itemId,
      total: total.toString(),
      lowest: low?.minPrice ?? "0",
      lowestYours: !!low?.yours,
      rows: ordered,
    });
  }
  for (const row of singles) lines.push({ key: "row-" + row.id, mode: "row", row });
  lines.sort((a, b) => {
    const an = a.mode === "stack" ? itemName(a.itemId) : itemName(a.row.itemId);
    const bn = b.mode === "stack" ? itemName(b.itemId) : itemName(b.row.itemId);
    const byName = an.localeCompare(bn);
    if (byName !== 0) return byName;
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  });
  return lines;
}

function kindsPresent(listings: LokListingView[]): ItemKind[] {
  const found = new Set<ItemKind>();
  for (const row of listings) {
    const kind = getItem(row.itemId)?.kind;
    if (kind) found.add(kind);
  }
  return KINDS.filter((kind) => found.has(kind));
}

function buyPreview(plan: QuantityPlan, qty: number): string {
  if (!Number.isSafeInteger(qty) || qty < 1 || qty > 1_000_000) return "Enter how many to buy.";
  if (plan.fills.length === 0) return "No ask you can buy. Your own listings are skipped.";
  let total = 0n;
  for (const fill of plan.fills) {
    if (/^\d+$/.test(fill.price)) total += BigInt(fill.price);
  }
  const shown = plan.fills.slice(0, 6).map((fill) => fill.price);
  const prices = shown.join(" + ") + (plan.fills.length > shown.length ? " + ..." : "");
  const over = BigInt(plan.filled) > BigInt(qty) ? " The last stack is taken whole." : "";
  const short = plan.short ? " The book runs out before that count." : "";
  return "Buys " + plan.filled + " for " + total.toString() + " KEK (" + prices + "), each ask at its own price." + over + short;
}

type Props = { listings: LokListingView[]; buyer: string };

export function AuctionBook({ listings, buyer }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | ItemKind>("all");
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [qty, setQty] = useState<Record<number, string>>({});
  const [bid, setBid] = useState<Record<string, string>>({});
  const weekSec = 7 * 24 * 60 * 60;
  const lines = auctionLines(listings, query, category);
  const kinds = kindsPresent(listings);

  return (
    <>
      <div className="cmd-section-label">Auction</div>
      <div className="lok-row">
        <input
          value={query}
          placeholder="Search name, kind, or slot"
          aria-label="Search auction"
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="lok-row">
        <button type="button" className={category === "all" ? "boot-primary" : "cmd-pill-tab"} onClick={() => setCategory("all")}>
          All
        </button>
        {kinds.map((kind) => (
          <button
            key={kind}
            type="button"
            className={category === kind ? "boot-primary" : "cmd-pill-tab"}
            onClick={() => setCategory(kind)}
          >
            {kindLabel(kind)}
          </button>
        ))}
      </div>
      {listings.length === 0 && <p className="lok-note">No listings.</p>}
      {listings.length > 0 && lines.length === 0 && <p className="lok-note">No listings match.</p>}
      {lines.map((line) => {
        if (line.mode === "stack") {
          const raw = qty[line.itemId] ?? "1";
          const n = Number(raw);
          const plan =
            Number.isSafeInteger(n) && n >= 1 && n <= 1_000_000
              ? planQuantityFills(line.rows.map(quoteOf), buyer, line.itemId, n)
              : { fills: [], filled: "0", short: true };
          const expanded = !!open[line.itemId];
          return (
            <div key={line.key}>
              <div className="lok-row">
                <span>
                  {itemName(line.itemId)} x{line.total} · lowest {line.lowest} KEK
                  {line.lowestYours ? " (yours)" : ""}
                </span>
                <button
                  type="button"
                  className="cmd-pill-tab"
                  onClick={() => setOpen({ ...open, [line.itemId]: !expanded })}
                >
                  {expanded ? "Hide" : "Stacks"}
                </button>
                <input
                  value={raw}
                  aria-label={"Quantity of " + itemName(line.itemId)}
                  onChange={(e) => setQty({ ...qty, [line.itemId]: e.target.value })}
                />
                <button
                  type="button"
                  className="cmd-pill-tab"
                  disabled={plan.fills.length === 0}
                  onClick={() => {
                    if (!Number.isSafeInteger(n) || n < 1 || n > 1_000_000 || plan.fills.length === 0) return;
                    send({ type: "lok/buy", itemId: line.itemId, qty: n });
                  }}
                >
                  Buy
                </button>
              </div>
              <p className="lok-note">{buyPreview(plan, n)}</p>
              {expanded && line.rows.map((row) => <ListingRow key={row.id} row={row} bid={bid} setBid={setBid} weekSec={weekSec} indent />)}
            </div>
          );
        }
        return <ListingRow key={line.key} row={line.row} bid={bid} setBid={setBid} weekSec={weekSec} />;
      })}
    </>
  );
}

function ListingRow({
  row,
  bid,
  setBid,
  weekSec,
  indent,
}: {
  row: LokListingView;
  bid: Record<string, string>;
  setBid: (next: Record<string, string>) => void;
  weekSec: number;
  indent?: boolean;
}) {
  return (
    <div className={indent ? "lok-row lok-indent" : "lok-row"}>
      <span>
        #{row.id} {itemName(row.itemId)} x{row.amount}
        {row.book ? " min " + row.minPrice : ""} · {row.sellerName} · bid {row.highBid}
        {row.highBidderName ? " by " + row.highBidderName : ""}
      </span>
      {row.book ? (
        <button type="button" className="cmd-pill-tab" onClick={() => send({ type: "lok/buy", itemId: row.itemId })}>
          Buy lowest
        </button>
      ) : (
        <>
          <input
            value={bid[row.id] ?? ""}
            placeholder="KEK"
            onChange={(e) => setBid({ ...bid, [row.id]: e.target.value })}
          />
          <button
            type="button"
            className="cmd-pill-tab"
            onClick={() => send({ type: "lok/bid", itemId: row.itemId, amount: bid[row.id] ?? "" })}
          >
            Bid
          </button>
        </>
      )}
      {row.yours && (
        <button type="button" className="cmd-pill-tab" onClick={() => send({ type: "lok/cancel", listingId: row.id })}>
          Cancel
        </button>
      )}
      {row.book && row.yours && row.listedAt > 0 && Date.now() / 1000 >= row.listedAt + weekSec && (
        <button type="button" className="cmd-pill-tab" onClick={() => send({ type: "lok/reclaim", listingId: row.id })}>
          Reclaim
        </button>
      )}
      {!row.book && row.highBidder && (
        <button type="button" className="cmd-pill-tab" onClick={() => send({ type: "lok/settle", listingId: row.id })}>
          Settle
        </button>
      )}
    </div>
  );
}

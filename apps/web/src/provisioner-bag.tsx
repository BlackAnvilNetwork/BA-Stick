import { getItem } from "@bellgrave/items";
import type { InventorySlot, LokItemBalance } from "@bellgrave/protocol";
import { useState } from "react";
import { parseEther } from "viem";
import { ItemCatalogDetails, ItemTipHost } from "./itemTip";
import { send } from "./net";

type Near = { id: string; name: string };

type Cell = {
  key: string;
  tokenId: number;
  name: string;
  bagAmount: number;
  starter: boolean;
  logAmount: string | null;
};

function itemName(tokenId: number): string {
  return getItem(tokenId)?.name ?? "Item " + tokenId;
}

function cellsOf(inventory: InventorySlot[], logItems: LokItemBalance[]): Cell[] {
  const cells: Cell[] = [];
  const seenLog = new Set<number>();
  for (const row of inventory) {
    const log = logItems.find((item) => item.tokenId === row.tokenId);
    if (log && !row.starter) seenLog.add(row.tokenId);
    cells.push({
      key: "bag-" + row.tokenId + (row.starter ? "-starter" : ""),
      tokenId: row.tokenId,
      name: itemName(row.tokenId),
      bagAmount: row.amount,
      starter: !!row.starter,
      logAmount: !row.starter && log ? log.amount : null,
    });
  }
  for (const row of logItems) {
    if (seenLog.has(row.tokenId)) continue;
    cells.push({
      key: "log-" + row.tokenId,
      tokenId: row.tokenId,
      name: itemName(row.tokenId),
      bagAmount: 0,
      starter: false,
      logAmount: row.amount,
    });
  }
  cells.sort((a, b) => a.name.localeCompare(b.name) || a.tokenId - b.tokenId);
  return cells;
}

type Props = {
  inventory: InventorySlot[];
  logItems: LokItemBalance[];
  inbox: LokItemBalance[];
  others: Near[];
};

export function ProvisionerBag({ inventory, logItems, inbox, others }: Props) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [inboxKey, setInboxKey] = useState<number | null>(null);
  const [toId, setToId] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const cells = cellsOf(inventory, logItems);
  const selected = others.find((unit) => unit.id === toId);
  let minPriceWei: string | null = null;
  const trimmed = minPrice.trim();
  if (trimmed) {
    try {
      const wei = parseEther(trimmed);
      if (wei > 0n) minPriceWei = wei.toString();
    } catch {
      minPriceWei = null;
    }
  }
  const priceOk = minPriceWei !== null;

  return (
    <div className="prov-hold">
      <div className="cmd-section-label">Send to</div>
      <div className="lok-row">
        {others.length === 0 && (
          <p className="lok-note">No other character is nearby. Pick someone in range. Names cannot be typed.</p>
        )}
        {selected && <span className="lok-note">Sending to {selected.name}</span>}
        {others.map((unit) => (
          <button
            key={unit.id}
            type="button"
            className={unit.id === toId ? "boot-primary" : "cmd-pill-tab"}
            onClick={() => setToId(unit.id)}
          >
            {unit.name}
          </button>
        ))}
      </div>

      <div className="cmd-section-label">Bag</div>
      {cells.length === 0 && <p className="lok-note">Bag is empty.</p>}
      <div className="prov-grid">
        {cells.map((cell) => {
          const open = openKey === cell.key;
          const qty =
            (cell.bagAmount > 0 ? "bag " + cell.bagAmount : "") +
            (cell.logAmount ? (cell.bagAmount > 0 ? " / " : "") + "log " + cell.logAmount : "");
          return (
            <div className="prov-cell-wrap" key={cell.key}>
              <ItemTipHost tokenId={cell.tokenId} active={!open}>
                <button
                  type="button"
                  className={open ? "prov-cell on" : "prov-cell"}
                  onClick={() => setOpenKey(open ? null : cell.key)}
                >
                  <span className="prov-cell-name">{cell.name}</span>
                  <span className="prov-cell-qty">
                    {qty}
                    {cell.starter ? " starter" : ""}
                  </span>
                </button>
              </ItemTipHost>
              {open && (
                <div className="prov-pop" role="menu" aria-label={cell.name}>
                  <div className="item-panel-details">
                    <ItemCatalogDetails tokenId={cell.tokenId} />
                  </div>
                  <button
                    type="button"
                    className="cmd-pill-tab"
                    disabled={cell.bagAmount < 1 || cell.starter}
                    title={cell.starter ? "Starter gear cannot be imported, listed, traded, or exported." : undefined}
                    onClick={() => send({ type: "lok/import", tokenId: cell.tokenId, amount: cell.bagAmount })}
                  >
                    Import
                  </button>
                  <input
                    value={minPrice}
                    placeholder="Minimum ETH"
                    aria-label="Minimum ask"
                    onChange={(e) => setMinPrice(e.target.value)}
                  />
                  <button
                    type="button"
                    className="cmd-pill-tab"
                    disabled={!cell.logAmount || !priceOk}
                    title={priceOk ? "List the log stack at this minimum." : "Enter a minimum ETH amount greater than 0."}
                    onClick={() => {
                      if (!cell.logAmount || !minPriceWei) return;
                      send({
                        type: "lok/list",
                        tokenId: cell.tokenId,
                        amount: Number(cell.logAmount),
                        minPrice: minPriceWei,
                      });
                    }}
                  >
                    List on Market
                  </button>
                  <button
                    type="button"
                    className="cmd-pill-tab"
                    disabled={!cell.logAmount || !toId}
                    onClick={() => {
                      if (!cell.logAmount || !toId) return;
                      send({
                        type: "lok/sendItem",
                        to: toId,
                        tokenId: cell.tokenId,
                        amount: Number(cell.logAmount),
                      });
                    }}
                  >
                    Send
                  </button>
                  <button
                    type="button"
                    className="cmd-pill-tab"
                    disabled={cell.bagAmount < 1}
                    onClick={() => send({ type: "item/discard", tokenId: cell.tokenId, starter: cell.starter })}
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    className="cmd-pill-tab"
                    disabled={!cell.logAmount}
                    onClick={() => {
                      if (!cell.logAmount) return;
                      send({ type: "lok/export", tokenId: cell.tokenId, amount: Number(cell.logAmount) });
                    }}
                  >
                    Export
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="cmd-section-label">Inbox</div>
      {inbox.length === 0 && <p className="lok-note">Nothing is waiting at the Provisioner.</p>}
      <div className="prov-grid">
        {inbox.map((row) => {
          const open = inboxKey === row.tokenId;
          return (
            <div className="prov-cell-wrap" key={"inbox-" + row.tokenId}>
              <ItemTipHost tokenId={row.tokenId} active={!open}>
                <button
                  type="button"
                  className={open ? "prov-cell on" : "prov-cell"}
                  onClick={() => setInboxKey(open ? null : row.tokenId)}
                >
                  <span className="prov-cell-name">{itemName(row.tokenId)}</span>
                  <span className="prov-cell-qty">x{row.amount}</span>
                </button>
              </ItemTipHost>
              {open && (
                <div className="prov-pop" role="menu" aria-label={"Take " + itemName(row.tokenId)}>
                  <div className="item-panel-details">
                    <ItemCatalogDetails tokenId={row.tokenId} />
                  </div>
                  <button
                    type="button"
                    className="cmd-pill-tab"
                    onClick={() => send({ type: "lok/takeInbox", tokenId: row.tokenId, amount: Number(row.amount) })}
                  >
                    Take
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

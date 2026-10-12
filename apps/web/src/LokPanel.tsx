import type { SnapshotMessage } from "@bellgrave/protocol";
import { useState } from "react";
import { AuctionBook } from "./auction-house";
import { ProvisionerBag } from "./provisioner-bag";
import { send } from "./net";
import { useGame } from "./state";

type Props = {
  you: SnapshotMessage["you"];
  onClose: () => void;
};

export function LokPanel({ you, onClose }: Props) {
  const units = useGame((s) => s.snapshot?.units ?? []);
  const lok = you.lok;
  const [toId, setToId] = useState("");
  const [ethAmt, setEthAmt] = useState("1");
  const others = units.filter(
    (u) => u.kind === "player" && !!u.characterId && u.characterId !== you.characterId,
  );
  const selected = others.find((u) => u.characterId === toId);

  if (!lok) {
    return (
      <div className="cmd-panel lok-panel">
        <div className="cmd-panel-head">
          <div>
            <div className="cmd-kicker">Ledger</div>
            <div className="cmd-panel-title">Exchange</div>
          </div>
          <button type="button" onClick={onClose} className="cmd-close-btn">
            Close
          </button>
        </div>
        <p>The log is not on this snapshot yet.</p>
      </div>
    );
  }

  const ethBal = lok.eth ?? lok.kek;
  const wait =
    lok.withdrawDelaySec == null
      ? "the vault delay"
      : lok.withdrawDelaySec % 3600 === 0
        ? lok.withdrawDelaySec / 3600 + " hours"
        : lok.withdrawDelaySec + " seconds";
  const chainNote =
    lok.chain === "engine-only"
      ? "No chain endpoint is configured. Deposit and withdraw are refused; spendable ETH on the log is unchanged."
      : lok.chain === "watching"
        ? "Deposits move local mock ETH/WETH into the vault. A withdrawal is queued for " +
          wait +
          " and is not paid out early. Spendable ETH is debited only after the queue exists."
        : "A chain endpoint is set, but this server is not watching the vault yet. Withdraw does not burn spendable ETH.";

  return (
    <div className="cmd-panel lok-panel">
      <div className="cmd-panel-head">
        <div>
          <div className="cmd-kicker">Provisioner</div>
          <div className="cmd-panel-title">Exchange</div>
          <div className="cmd-panel-sub">
            AH · sends · ETH {ethBal}
            {lok.gold != null ? ` · gold ${lok.gold}` : ""}
          </div>
        </div>
        <button type="button" onClick={onClose} className="cmd-close-btn">
          Close
        </button>
      </div>
      <p className="lok-note">{chainNote}</p>

      <AuctionBook listings={lok.listings} buyer={lok.tokenId} />
      <ProvisionerBag
        inventory={you.inventory}
        logItems={lok.items}
        inbox={lok.inbox ?? []}
        others={others.flatMap((unit) => (unit.characterId ? [{ id: unit.characterId, name: unit.name }] : []))}
      />
      <div className="cmd-section-label">Send ETH to</div>
      <div className="lok-row">
        {others.length === 0 && (
          <p className="lok-note">No other character is nearby. Pick someone in range. Names cannot be typed.</p>
        )}
        {selected && <span className="lok-note">Sending to {selected.name}</span>}
        {others.map((u) => (
          <button
            key={u.characterId}
            type="button"
            className={u.characterId === toId ? "boot-primary" : "cmd-pill-tab"}
            onClick={() => setToId(u.characterId ?? "")}
          >
            {u.name}
          </button>
        ))}
      </div>
      <div className="lok-row">
        <input value={ethAmt} onChange={(e) => setEthAmt(e.target.value)} aria-label="ETH amount" />
        <button
          type="button"
          className="boot-primary"
          disabled={!toId}
          onClick={() => toId && send({ type: "lok/sendKek", to: toId, amount: ethAmt })}
        >
          Send ETH
        </button>
        <button
          type="button"
          className="boot-primary"
          onClick={() => send({ type: "lok/deposit", amount: ethAmt })}
        >
          Deposit ETH
        </button>
        <button
          type="button"
          className="cmd-pill-tab"
          onClick={() => send({ type: "lok/withdrawKek", amount: ethAmt })}
        >
          Queue withdrawal
        </button>
      </div>
      <div className="cmd-section-label">Vault queue - {wait}</div>
      {lok.queues.length === 0 && <p className="lok-note">No withdrawal is queued.</p>}
      {lok.queues.map((row) => (
        <div className="lok-row" key={row.id}>
          <span>
            #{row.id} {row.amount} ETH - claimable {new Date(row.availableAt * 1000).toLocaleString()}
          </span>
          <button type="button" className="cmd-pill-tab" onClick={() => send({ type: "lok/claimKek", id: row.id })}>
            Claim
          </button>
        </div>
      ))}

    </div>
  );
}
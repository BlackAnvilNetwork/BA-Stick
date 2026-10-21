import type { SnapshotMessage } from "@bellgrave/protocol";
import { AuctionBook } from "./auction-house";
import { ProvisionerBag } from "./provisioner-bag";
import { useGame } from "@bellgrave/client-core/state";

type Props = {
  you: SnapshotMessage["you"];
  onClose: () => void;
};

export function LokPanel({ you, onClose }: Props) {
  const units = useGame((s) => s.snapshot?.units ?? []);
  const lok = you.lok;
  const others = units.filter(
    (u) => u.kind === "player" && !!u.characterId && u.characterId !== you.characterId,
  );

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

  return (
    <div className="cmd-panel lok-panel">
      <div className="cmd-panel-head">
        <div>
          <div className="cmd-kicker">Provisioner</div>
          <div className="cmd-panel-title">Exchange</div>
          <div className="cmd-panel-sub">
            AH · items
            {lok.gold != null ? ` · gold ${lok.gold}` : ""}
          </div>
        </div>
        <button type="button" onClick={onClose} className="cmd-close-btn">
          Close
        </button>
      </div>
      <p className="lok-note">
        The log tracks your character and items only. Auction house and PvP pay native settlement currency
        on-chain via EEZ — there is no in-game deposit or spendable balance.
      </p>

      <AuctionBook
        listings={lok.listings}
        buyer={lok.tokenId}
        ahEscrow={lok.ahEscrow ?? null}
        eezSyncBuy={lok.eezSyncBuy ?? null}
      />
      <ProvisionerBag
        inventory={you.inventory}
        logItems={lok.items}
        inbox={lok.inbox ?? []}
        others={others.flatMap((unit) => (unit.characterId ? [{ id: unit.characterId, name: unit.name }] : []))}
      />
    </div>
  );
}

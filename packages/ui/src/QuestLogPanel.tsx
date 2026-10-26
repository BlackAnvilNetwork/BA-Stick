import { memo } from "react";
import type { SnapshotMessage } from "@bellgrave/protocol";

export type QuestLogEntry = NonNullable<SnapshotMessage["you"]["questLog"]>[number];

type Props = {
  entries: readonly QuestLogEntry[];
  onClose: () => void;
};

function entriesEqual(a: readonly QuestLogEntry[], b: readonly QuestLogEntry[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (x.id !== y.id || x.kills !== y.kills || x.need !== y.need || x.ready !== y.ready) return false;
  }
  return true;
}

/** Active Pale Hollow kill tasks (props from Hud — no extra store subscription). */
export const QuestLogPanel = memo(function QuestLogPanel({ entries, onClose }: Props) {
  return (
    <div className="quest-log-panel">
      <div className="quest-log-head">
        <div>
          <div className="cmd-kicker">Journal</div>
          <div>Quest log</div>
          <div className="quest-log-sub">
            {entries.length === 0
              ? "Talk to field keepers or the Herald to pick up work."
              : `${entries.length} active · return to the quest giver to turn in`}
          </div>
        </div>
        <button type="button" className="cmd-close-btn" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="quest-log-list mmo-scroll" role="list">
        {entries.length === 0 ? (
          <p className="quest-log-empty">No active quests.</p>
        ) : (
          entries.map((q) => {
            const pct = q.need > 0 ? Math.min(100, Math.round((q.kills / q.need) * 100)) : 0;
            return (
              <article key={q.id} className={`quest-log-row${q.ready ? " ready" : ""}`} role="listitem">
                <div className="quest-log-row-title">{q.title}</div>
                <p className="quest-log-row-blurb">{q.progress}</p>
                <div className="quest-log-row-foot">
                  <div className="quest-log-bar" aria-hidden>
                    <i style={{ width: `${pct}%` }} />
                  </div>
                  <span className="quest-log-count">
                    {q.kills}/{q.need}
                  </span>
                  {q.ready ? <span className="quest-log-ready">Ready to turn in</span> : null}
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}, (prev, next) => prev.onClose === next.onClose && entriesEqual(prev.entries, next.entries));

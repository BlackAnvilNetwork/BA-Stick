import type { UnitSnapshot } from "@bellgrave/protocol";

/** Floater kinds, matching `floaters::kind` in ba-stick-render. */
export const FLOAT = { damage: 0, selfDamage: 1, heal: 2, crit: 3, miss: 4 } as const;
export type FloatEvent = { id: string; kind: number; value: number };

const HIT = /^You hit (.+) for (\d+)(.*)\.$/;
const MISSES_YOU = /misses you\.$|— miss!$/;
const HOLD_MS = 150;

/**
 * Turns server state into floating combat numbers (#45). The 20 Hz protocol has
 * no structured combat events, so damage/heal come from per-unit HP deltas
 * (works for every unit, any source) and crits/misses from the player's own
 * log lines ("You hit X for N (Critical!).", "You miss.", "X misses you.").
 * HP deltas are held briefly so a crit line that lands a tick later still
 * upgrades the matching number.
 */
export class CombatFloaters {
  private hp = new Map<string, number>();
  private log: string[] | null = null;
  private pending: (FloatEvent & { t: number; name: string })[] = [];
  private crits: { name: string; value: number; t: number }[] = [];

  /** Forget everything (zone change). */
  reset(): void {
    this.hp.clear();
    this.pending = [];
    this.crits = [];
  }

  scan(units: readonly UnitSnapshot[], me: UnitSnapshot | undefined, log: readonly string[], now: number): FloatEvent[] {
    const out: FloatEvent[] = [];
    for (const line of this.newLines(log)) {
      const m = HIT.exec(line);
      if (m && /Critical/.test(m[3]!)) this.crits.push({ name: m[1]!, value: Number(m[2]), t: now });
      else if (line === "You miss." && me?.targetId) out.push({ id: me.targetId, kind: FLOAT.miss, value: 0 });
      else if (MISSES_YOU.test(line) && me) out.push({ id: me.id, kind: FLOAT.miss, value: 0 });
    }
    const seen = new Set<string>();
    for (const u of units) {
      seen.add(u.id);
      const prev = this.hp.get(u.id);
      this.hp.set(u.id, u.hp);
      if (prev === undefined || prev <= 0 || u.hp === prev) continue;
      const self = me !== undefined && u.id === me.id;
      const value = Math.abs(u.hp - prev);
      if (u.hp > prev) out.push({ id: u.id, kind: FLOAT.heal, value });
      else this.pending.push({ id: u.id, kind: self ? FLOAT.selfDamage : FLOAT.damage, value, t: now, name: u.name });
    }
    for (const id of this.hp.keys()) if (!seen.has(id)) this.hp.delete(id);
    // Emit held damage: upgraded to crit when a matching line arrived, else after HOLD_MS.
    this.pending = this.pending.filter((p) => {
      const ci = this.crits.findIndex((c) => c.name === p.name && c.value === p.value);
      if (ci >= 0) {
        this.crits.splice(ci, 1);
        out.push({ id: p.id, kind: FLOAT.crit, value: p.value });
        return false;
      }
      if (now - p.t >= HOLD_MS) {
        out.push({ id: p.id, kind: p.kind, value: p.value });
        return false;
      }
      return true;
    });
    this.crits = this.crits.filter((c) => now - c.t < 1000);
    return out;
  }

  /** Lines appended since the last call (the server log is a rolling window). */
  private newLines(log: readonly string[]): string[] {
    const prev = this.log;
    this.log = [...log];
    if (!prev) return [];
    // longest suffix of prev that is a prefix of log
    for (let k = Math.min(prev.length, log.length); k > 0; k--) {
      let ok = true;
      for (let i = 0; i < k && ok; i++) ok = prev[prev.length - k + i] === log[i];
      if (ok) return log.slice(k);
    }
    return prev.length && log.length && prev.join("\n") === log.join("\n") ? [] : [...log];
  }
}

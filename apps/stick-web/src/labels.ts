import type { UnitSnapshot } from "@bellgrave/protocol";
import { sameId } from "./fx";

export type LabelCtx = { wallet: string | null; selected: string | null; hovered: string | null };

export type LabelInfo = {
  text: string;
  cls: string;
  hp?: number;
  maxHp?: number;
};

/**
 * Nameplate text for a unit, or null when hidden. NPCs always; mobs and other
 * players when selected or hovered (bounty players always). You always see
 * your own name and HP above your head.
 */
export function labelFor(u: UnitSnapshot, c: LabelCtx): LabelInfo | null {
  if (sameId(u.id, c.wallet)) {
    return { text: u.name, cls: "player self", hp: u.hp, maxHp: u.maxHp };
  }
  if (u.gatherNode) return c.hovered === u.id ? { text: u.name, cls: "npc" } : null;
  if (u.kind === "mob" && (u.anim === "dead" || u.hp <= 0)) return null;
  if (u.kind === "npc") return { text: u.name, cls: "npc" };
  const focus = c.selected === u.id || c.hovered === u.id;
  if (!focus && !(u.kind === "player" && u.pvpBounty)) return null;
  if (u.kind === "mob") {
    return {
      text: `${u.shiny ? "★ " : ""}${u.name}${u.level ? ` Lv${u.level}` : ""}`,
      cls: u.shiny ? "mob shiny" : "mob",
    };
  }
  return {
    text: `${u.pvpBounty ? "☠ " : ""}${u.name}`,
    cls: u.pvpBounty ? "player bounty" : "player",
    hp: u.hp,
    maxHp: u.maxHp,
  };
}

type ShownLabel = LabelInfo & { x: number; y: number };

/** Imperative DOM labels (one div per unit), repositioned each frame. */
export class Labels {
  private els = new Map<string, HTMLDivElement>();
  constructor(private root: HTMLElement) {}
  update(shown: Map<string, ShownLabel>): void {
    for (const [id, el] of this.els) {
      if (!shown.has(id)) {
        el.remove();
        this.els.delete(id);
      }
    }
    for (const [id, l] of shown) {
      let el = this.els.get(id);
      if (!el) {
        el = document.createElement("div");
        const name = document.createElement("span");
        name.className = "stick-label-name";
        el.appendChild(name);
        this.root.appendChild(el);
        this.els.set(id, el);
      }
      const nameEl = el.firstElementChild as HTMLSpanElement | null;
      if (nameEl && nameEl.textContent !== l.text) nameEl.textContent = l.text;
      const cls = `stick-label ${l.cls}`;
      if (el.className !== cls) el.className = cls;
      const wantsHp = l.maxHp != null && l.maxHp > 0;
      let bar = el.querySelector(".stick-label-hp") as HTMLDivElement | null;
      if (wantsHp) {
        if (!bar) {
          bar = document.createElement("div");
          bar.className = "stick-label-hp";
          const fill = document.createElement("i");
          bar.appendChild(fill);
          el.appendChild(bar);
        }
        const fill = bar.firstElementChild as HTMLElement;
        const pct = Math.max(0, Math.min(100, ((l.hp ?? 0) / l.maxHp!) * 100));
        const width = `${pct.toFixed(1)}%`;
        if (fill.style.width !== width) fill.style.width = width;
      } else if (bar) {
        bar.remove();
      }
      el.style.transform = `translate(${Math.round(l.x)}px, ${Math.round(l.y)}px) translate(-50%, -100%)`;
    }
  }
  clear(): void {
    for (const el of this.els.values()) el.remove();
    this.els.clear();
  }
}

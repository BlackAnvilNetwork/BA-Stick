import type { UnitSnapshot } from "@bellgrave/protocol";
import { sameId } from "./fx";

export type LabelCtx = { wallet: string | null; selected: string | null; hovered: string | null };

/**
 * Nameplate text for a unit, or null when hidden. Legacy rules: NPC names
 * always; mobs and other players when selected (we also show on hover);
 * never your own. Mobs carry their level, bounty players a mark.
 */
export function labelFor(u: UnitSnapshot, c: LabelCtx): { text: string; cls: string } | null {
  if (sameId(u.id, c.wallet)) return null;
  if (u.gatherNode) return c.hovered === u.id ? { text: u.name, cls: "npc" } : null;
  if (u.kind === "mob" && (u.anim === "dead" || u.hp <= 0)) return null;
  if (u.kind === "npc") return { text: u.name, cls: "npc" };
  const focus = c.selected === u.id || c.hovered === u.id;
  if (!focus && !(u.kind === "player" && u.pvpBounty)) return null;
  if (u.kind === "mob") return { text: `${u.shiny ? "★ " : ""}${u.name}${u.level ? ` Lv${u.level}` : ""}`, cls: u.shiny ? "mob shiny" : "mob" };
  return { text: `${u.pvpBounty ? "☠ " : ""}${u.name}`, cls: u.pvpBounty ? "player bounty" : "player" };
}

/** Imperative DOM labels (one div per unit), repositioned each frame. */
export class Labels {
  private els = new Map<string, HTMLDivElement>();
  constructor(private root: HTMLElement) {}
  update(shown: Map<string, { text: string; cls: string; x: number; y: number }>): void {
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
        this.root.appendChild(el);
        this.els.set(id, el);
      }
      if (el.textContent !== l.text) el.textContent = l.text;
      const cls = `stick-label ${l.cls}`;
      if (el.className !== cls) el.className = cls;
      el.style.transform = `translate(${Math.round(l.x)}px, ${Math.round(l.y)}px) translate(-50%, -100%)`;
    }
  }
  clear(): void {
    for (const el of this.els.values()) el.remove();
    this.els.clear();
  }
}

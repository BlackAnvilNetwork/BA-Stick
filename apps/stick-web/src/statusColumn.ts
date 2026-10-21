import { abilityIconUrl } from "@bellgrave/combat";
import { chromaKeyIconUrl } from "@bellgrave/ui/chroma-icons";
import type { WorldStatusIcon } from "@bellgrave/ui/statusIcons";

/** Icon size in framebuffer pixels (scaled with the canvas). */
export const STATUS_ICON_FB = 9;

/**
 * Status icon column beside the torso (old `UnitStatusIcons`): one stacked
 * column per unit, pixelated, using the chroma-keyed ability PNGs.
 */
export class StatusColumns {
  private cols = new Map<string, { el: HTMLDivElement; key: string }>();
  constructor(private root: HTMLElement) {}
  update(shown: Map<string, { icons: WorldStatusIcon[]; x: number; y: number; scale: number }>): void {
    for (const [id, c] of this.cols) {
      if (!shown.has(id)) {
        c.el.remove();
        this.cols.delete(id);
      }
    }
    for (const [id, s] of shown) {
      const key = s.icons.map((i) => i.id).join(",");
      let c = this.cols.get(id);
      if (!c) {
        const el = document.createElement("div");
        el.className = "stick-status-col";
        this.root.appendChild(el);
        c = { el, key: "" };
        this.cols.set(id, c);
      }
      if (c.key !== key) {
        c.key = key;
        c.el.replaceChildren(
          ...s.icons.map((i) => {
            const img = document.createElement("img");
            img.className = `stick-status-icon ${i.kind}`;
            img.alt = "";
            img.title = i.id;
            const raw = abilityIconUrl(i.id);
            void chromaKeyIconUrl(raw).then((u) => (img.src = u));
            return img;
          }),
        );
      }
      const px = STATUS_ICON_FB * s.scale;
      c.el.style.setProperty("--icon", `${px}px`);
      c.el.style.transform = `translate(${Math.round(s.x)}px, ${Math.round(s.y)}px)`;
    }
  }
  clear(): void {
    for (const c of this.cols.values()) c.el.remove();
    this.cols.clear();
  }
}

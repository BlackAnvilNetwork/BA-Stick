import { PH_ALL_NODES } from "@bellgrave/config";
import type { UnitSnapshot } from "@bellgrave/protocol";

export type GatherMethod = "mine" | "harvest" | "fish";
type NodeDef = { name: string; kind: string; yields: readonly string[] };

/**
 * Gather method for a live node. Snapshots carry only name + primary yield
 * (live ids are `ph-live-N`), so match the authored defs by name, then yield.
 */
export function gatherMethod(u: Pick<UnitSnapshot, "name" | "gatherYield">, defs: readonly NodeDef[] = PH_ALL_NODES): GatherMethod {
  const d = defs.find((n) => n.name === u.name) ?? defs.find((n) => n.yields[0] === u.gatherYield);
  const k = d?.kind;
  return k === "mine" || k === "fish" ? k : "harvest";
}

export type IconAtlas = { size: number; cols: number; index: Record<string, number> };

/** Atlas cell for a yield slug (falls back to dustgrain like the old client). */
export function iconCell(atlas: IconAtlas, slug: string | undefined): { x: number; y: number } | null {
  const i = atlas.index[slug ?? "dustgrain"] ?? atlas.index.dustgrain;
  if (i === undefined) return null;
  return { x: (i % atlas.cols) * atlas.size, y: Math.floor(i / atlas.cols) * atlas.size };
}

let atlasP: Promise<IconAtlas | null> | null = null;
export function loadIconAtlas(base: string): Promise<IconAtlas | null> {
  atlasP ??= fetch(`${base}zones/icons.json`).then((r) => (r.ok ? (r.json() as Promise<IconAtlas>) : null)).catch(() => null);
  return atlasP;
}

/**
 * Floating yield icons over gather nodes (old GatherNodeSprite): one pixelated
 * div per node using the baked atlas, bobbing gently; dimmed when depleted.
 */
export class GatherIcons {
  private els = new Map<string, HTMLDivElement>();
  constructor(private root: HTMLElement, private url: string) {}
  update(atlas: IconAtlas | null, shown: Map<string, { slug?: string; x: number; y: number; scale: number; ready: boolean }>, t: number): void {
    for (const [id, el] of this.els) {
      if (!shown.has(id)) {
        el.remove();
        this.els.delete(id);
      }
    }
    if (!atlas) return;
    for (const [id, s] of shown) {
      let el = this.els.get(id);
      const cell = iconCell(atlas, s.slug);
      if (!cell) continue;
      const px = atlas.size * s.scale;
      if (!el) {
        el = document.createElement("div");
        el.className = "stick-gather-icon";
        this.root.appendChild(el);
        this.els.set(id, el);
      }
      const bob = Math.sin(t * 2 + s.x * 0.05) * 1.5 * s.scale;
      el.style.width = el.style.height = `${px}px`;
      el.style.backgroundImage = `url(${this.url})`;
      el.style.backgroundSize = `${atlas.cols * px}px auto`;
      el.style.backgroundPosition = `-${cell.x * s.scale}px -${cell.y * s.scale}px`;
      el.style.transform = `translate(${Math.round(s.x - px / 2)}px, ${Math.round(s.y - px + bob)}px)`;
      el.style.opacity = s.ready ? "1" : "0.4";
      el.style.filter = s.ready ? "" : "grayscale(1)";
    }
  }
  clear(): void {
    for (const el of this.els.values()) el.remove();
    this.els.clear();
  }
}

export function isGatherNode(u: UnitSnapshot): boolean {
  return !!u.gatherNode;
}

import {
  CATALOG,
  CRAFT_SKILL_LABEL,
  craftGoldCost,
  getItem,
  itemIcon,
  recipeMaterialGroups,
  recipesUsingMaterial,
  type ItemDef,
} from "@bellgrave/items";
import { CatalogSortToggle } from "@bellgrave/ui/catalog-sort";
import {
  categoryCount,
  compareCatalogDefs,
  EQUIP_SLOTS,
  KIND_TREE,
  matchesCategory,
  SLOT_LABEL,
  type CatalogSort,
  WEAPON_FAMILIES,
  WEAPON_FAMILY_LABEL,
  weaponCategoryId,
} from "@bellgrave/ui/catalog-tree";
import { formatJobs, ItemCatalogDetails } from "@bellgrave/ui/itemTip";
import { useMemo, useRef, useState } from "react";
import { WikiCraftPanel } from "./WikiCraftPanel";
import { WikiLorePanel } from "./WikiLorePanel";
import { WikiGearPreview } from "./WikiGearPreview";
import { gearRonForSlug, gearViewerUrl } from "./wiki-gear";

function formatRecipe(def: ItemDef): string {
  const groups = recipeMaterialGroups(def);
  if (!groups.length) return "—";
  return groups
    .map((g) => g.options.map((o) => `${o.name}×${o.qty}`).join(" or "))
    .join(", ");
}

type Props = { onClose: () => void };

export function WikiPage({ onClose }: Props) {
  const itemSectionRef = useRef<HTMLElement>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>("kind:base");
  const [equipmentOpen, setEquipmentOpen] = useState(true);
  const [mainHandOpen, setMainHandOpen] = useState(true);
  const [focusId, setFocusId] = useState<number | null>(null);
  const [sort, setSort] = useState<CatalogSort>("name");

  const searching = query.trim().length > 0;
  const lines = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out: ItemDef[] = [];
    for (const def of CATALOG) {
      if (q) {
        if (!def.name.toLowerCase().includes(q) && !def.slug.includes(q)) continue;
      } else if (!selected || !matchesCategory(def, selected)) {
        continue;
      }
      out.push(def);
    }
    out.sort((a, b) => compareCatalogDefs(a, b, sort));
    return out;
  }, [query, selected, sort]);

  const focus = focusId != null ? getItem(focusId) : null;
  const usedIn = focus ? recipesUsingMaterial(focus.slug) : [];

  const openItemFromCraft = (itemId: number) => {
    setFocusId(itemId);
    itemSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="wiki-overlay" role="dialog" aria-label="Game wiki">
      <div className="wiki-panel wiki-panel-stack">
        <header className="wiki-head">
          <div>
            <div className="cmd-kicker">Black Anvil</div>
            <h2 className="wiki-title">Wiki</h2>
            <p className="lok-note">World lore, item catalog (auction house categories) and crafting recipes by skill and level.</p>
          </div>
          <button type="button" className="cmd-close-btn" onClick={onClose}>
            Close
          </button>
        </header>
        <section className="wiki-section wiki-lore-section" aria-labelledby="wiki-lore-title">
          <h3 id="wiki-lore-title" className="wiki-section-title">
            The world
          </h3>
          <WikiLorePanel />
        </section>
        <section ref={itemSectionRef} className="wiki-section" aria-labelledby="wiki-items-title">
          <h3 id="wiki-items-title" className="wiki-section-title">
            Item wiki
          </h3>
        <label className="prov-search wiki-search">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name…"
            aria-label="Search items"
          />
        </label>
        <CatalogSortToggle value={sort} onChange={setSort} />
        <div className="prov-split wiki-split">
          <div className="prov-tree wiki-tree" role="tree" aria-label="Categories">
            {KIND_TREE.map(({ kind, label, slots }) => {
              const kindId = "kind:" + kind;
              const kindCount = categoryCount(kindId, query);
              if (slots) {
                return (
                  <div key={kind} role="treeitem" aria-expanded={equipmentOpen}>
                    <div className="prov-branch">
                      <button
                        type="button"
                        className="prov-chev"
                        aria-label={equipmentOpen ? "Collapse equipment" : "Expand equipment"}
                        onClick={() => setEquipmentOpen((o) => !o)}
                      >
                        {equipmentOpen ? "▾" : "▸"}
                      </button>
                      <button
                        type="button"
                        className={selected === kindId && !searching ? "prov-node on" : "prov-node"}
                        onClick={() => {
                          setSelected(kindId);
                          setQuery("");
                        }}
                      >
                        {label}
                        <span className="prov-count">{kindCount}</span>
                      </button>
                    </div>
                    {equipmentOpen && (
                      <div className="prov-children">
                        {EQUIP_SLOTS.map((slot) => {
                          const slotId = "slot:" + slot;
                          const slotCount = categoryCount(slotId, query);
                          if (slot === "main") {
                            return (
                              <div key={slot} role="treeitem" aria-expanded={mainHandOpen}>
                                <div className="prov-branch">
                                  <button
                                    type="button"
                                    className="prov-chev"
                                    aria-label={mainHandOpen ? "Collapse main-hand weapons" : "Expand main-hand weapons"}
                                    onClick={() => setMainHandOpen((o) => !o)}
                                  >
                                    {mainHandOpen ? "▾" : "▸"}
                                  </button>
                                  <button
                                    type="button"
                                    className={selected === slotId && !searching ? "prov-node on" : "prov-node"}
                                    onClick={() => {
                                      setSelected(slotId);
                                      setQuery("");
                                    }}
                                  >
                                    {SLOT_LABEL[slot]}
                                    <span className="prov-count">{slotCount}</span>
                                  </button>
                                </div>
                                {mainHandOpen && (
                                  <div className="prov-children">
                                    {WEAPON_FAMILIES.map((family) => {
                                      const wid = weaponCategoryId(family);
                                      const wCount = categoryCount(wid, query);
                                      return (
                                        <button
                                          key={family}
                                          type="button"
                                          role="treeitem"
                                          className={selected === wid && !searching ? "prov-node on" : "prov-node"}
                                          onClick={() => {
                                            setSelected(wid);
                                            setQuery("");
                                          }}
                                        >
                                          {WEAPON_FAMILY_LABEL[family]}
                                          <span className="prov-count">{wCount}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          }
                          return (
                            <button
                              key={slot}
                              type="button"
                              role="treeitem"
                              className={selected === slotId && !searching ? "prov-node on" : "prov-node"}
                              onClick={() => {
                                setSelected(slotId);
                                setQuery("");
                              }}
                            >
                              {SLOT_LABEL[slot]}
                              <span className="prov-count">{slotCount}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }
              return (
                <button
                  key={kind}
                  type="button"
                  role="treeitem"
                  className={selected === kindId && !searching ? "prov-node on" : "prov-node"}
                  onClick={() => {
                    setSelected(kindId);
                    setQuery("");
                  }}
                >
                  {label}
                  <span className="prov-count">{kindCount}</span>
                </button>
              );
            })}
          </div>
          <div className="prov-book wiki-list" aria-label="Items">
            {!searching && !selected && <p className="lok-note">Choose a category.</p>}
            {(searching || selected) && lines.length === 0 && <p className="lok-note">No items match.</p>}
            {lines.map((def) => {
              const jobs = formatJobs(def.jobRestrict);
              return (
                <button
                  key={def.id}
                  type="button"
                  className={focusId === def.id ? "prov-commodity on wiki-item-row" : "prov-commodity wiki-item-row"}
                  onClick={() => setFocusId(def.id)}
                >
                  <img src={itemIcon(def.id)} alt="" width={24} height={24} className="wiki-row-icon" />
                  <span className="prov-name">{def.name}</span>
                  <span className="wiki-item-ilvl">
                    {def.craftLevel != null ? `iLv.${def.craftLevel}` : "—"}
                  </span>
                  <span className="wiki-item-jobs" title={jobs || "All jobs"}>
                    {jobs || "All"}
                  </span>
                </button>
              );
            })}
          </div>
          <aside className="wiki-detail" aria-label="Item details">
            {!focus && <p className="lok-note">Select an item for recipe and stats.</p>}
            {focus && (
              <>
                <div className="item-panel-details">
                  <ItemCatalogDetails tokenId={focus.id} />
                </div>
                <p className="wiki-desc">{focus.description}</p>
                {focus.obtainedFrom ? (
                  <p className="lok-note">
                    <strong>Obtained:</strong> {focus.obtainedFrom}
                  </p>
                ) : null}
                {focus.recipe && focus.craftSkill != null && focus.craftLevel != null ? (
                  <div className="wiki-recipe">
                    <div className="cmd-kicker">Craft</div>
                    <p>
                      {CRAFT_SKILL_LABEL[focus.craftSkill]} L{focus.craftLevel} ·{" "}
                      {focus.recipe.gold ?? craftGoldCost(focus.craftLevel)} gold
                    </p>
                    <p className="wiki-mats">{formatRecipe(focus)}</p>
                  </div>
                ) : (
                  <p className="lok-note">Not player-crafted (drop, vendor, or gather).</p>
                )}
                {focus.consume ? (
                  <p className="lok-note">
                    <strong>Use:</strong>{" "}
                    {[
                      focus.consume.hp != null ? `+${focus.consume.hp} HP` : null,
                      focus.consume.mp != null ? `+${focus.consume.mp} MP` : null,
                      focus.consume.scrollSpellId ? `Scroll: ${focus.consume.scrollSpellId}` : null,
                      focus.consume.foodDurationSec ? `Food ${focus.consume.foodDurationSec}s` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                ) : null}
                {focus.weaponFamily ? (
                  <p className="lok-note">
                    <strong>Weapon family:</strong> {focus.weaponFamily}
                  </p>
                ) : null}
                {formatJobs(focus.jobRestrict) ? (
                  <p className="lok-note">
                    <strong>Jobs:</strong> {formatJobs(focus.jobRestrict)}
                  </p>
                ) : null}
                {usedIn.length > 0 ? (
                  <div className="wiki-used-in">
                    <div className="cmd-kicker">Used in</div>
                    <ul>
                      {usedIn.slice(0, 12).map((r) => (
                        <li key={r.id}>
                          <button type="button" className="wiki-link" onClick={() => setFocusId(r.id)}>
                            {r.name}
                          </button>
                        </li>
                      ))}
                      {usedIn.length > 12 ? <li>…and {usedIn.length - 12} more</li> : null}
                    </ul>
                  </div>
                ) : null}
                {(() => {
                  const gearId = gearRonForSlug(focus.slug);
                  if (!gearId) return null;
                  return (
                    <>
                      <WikiGearPreview gearId={gearId} />
                      <p className="wiki-gear">
                        <a href={gearViewerUrl(gearId)} target="_blank" rel="noreferrer">
                          Open in gear viewer ({gearId}.ron)
                        </a>
                      </p>
                    </>
                  );
                })()}
              </>
            )}
          </aside>
        </div>
        </section>
        <section className="wiki-section" aria-labelledby="wiki-craft-title">
          <h3 id="wiki-craft-title" className="wiki-section-title">
            Crafting wiki
          </h3>
          <WikiCraftPanel onOpenItem={openItemFromCraft} />
        </section>
      </div>
    </div>
  );
}

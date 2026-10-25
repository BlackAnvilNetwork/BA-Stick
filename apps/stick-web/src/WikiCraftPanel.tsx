import {
  CRAFT_SKILLS,
  CRAFT_SKILL_LABEL,
  craftGoldCost,
  craftOutputQty,
  craftablesForSkill,
  getItem,
  itemIcon,
  maxCraftLevelForSkill,
  recipeMaterialGroups,
  type CraftSkill,
  type ItemDef,
} from "@bellgrave/items";
import { useMemo, useState } from "react";

function formatRecipe(def: ItemDef): string {
  const groups = recipeMaterialGroups(def);
  if (!groups.length) return "—";
  return groups
    .map((g) => g.options.map((o) => `${o.name}×${o.qty}`).join(" or "))
    .join(", ");
}

type Props = {
  onOpenItem?: (itemId: number) => void;
};

export function WikiCraftPanel({ onOpenItem }: Props) {
  const [skill, setSkill] = useState<CraftSkill>("smithing");
  const [focusId, setFocusId] = useState<number | null>(null);

  const byLevel = useMemo(() => {
    const map = new Map<number, ItemDef[]>();
    for (const def of craftablesForSkill(skill)) {
      const lv = def.craftLevel ?? 1;
      const list = map.get(lv) ?? [];
      list.push(def);
      map.set(lv, list);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [skill]);

  const focus = focusId != null ? getItem(focusId) : null;
  const maxLv = maxCraftLevelForSkill(skill);

  return (
    <div className="wiki-craft">
      <p className="lok-note wiki-craft-intro">
        Pick a craft skill, then browse recipes from L1 through L{maxLv || "—"} (same data as in-game crafting).
      </p>
      <div className="prov-split wiki-split wiki-craft-split">
        <div className="wiki-tree wiki-craft-skills" role="tablist" aria-label="Craft skills">
          {CRAFT_SKILLS.map((s) => {
            const max = maxCraftLevelForSkill(s);
            const count = craftablesForSkill(s).length;
            return (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={skill === s}
                className={skill === s ? "prov-node on" : "prov-node"}
                onClick={() => {
                  setSkill(s);
                  setFocusId(null);
                }}
              >
                {CRAFT_SKILL_LABEL[s]}
                <span className="prov-count">
                  {count} · L{max || "—"}
                </span>
              </button>
            );
          })}
        </div>
        <div className="prov-book wiki-list wiki-craft-list" aria-label="Recipes by level">
          {byLevel.length === 0 ? <p className="lok-note">No recipes for this skill.</p> : null}
          {byLevel.map(([level, recipes]) => (
            <div key={level} className="wiki-craft-level">
              <div className="wiki-craft-level-head">Level {level}</div>
              {recipes.map((def) => (
                <button
                  key={def.id}
                  type="button"
                  className={focusId === def.id ? "prov-commodity on" : "prov-commodity"}
                  onClick={() => setFocusId(def.id)}
                >
                  <img src={itemIcon(def.id)} alt="" width={24} height={24} className="wiki-row-icon" />
                  <span className="prov-name">{def.name}</span>
                  <span className="prov-qty">
                    {def.recipe?.gold ?? craftGoldCost(level)}g
                    {craftOutputQty(def) > 1 ? ` · ×${craftOutputQty(def)}` : ""}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
        <aside className="wiki-detail wiki-craft-detail" aria-label="Recipe details">
          {!focus && <p className="lok-note">Select a recipe for materials and output.</p>}
          {focus && focus.craftSkill && focus.craftLevel != null && focus.recipe ? (
            <>
              <div className="cmd-kicker">{CRAFT_SKILL_LABEL[focus.craftSkill]}</div>
              <p className="wiki-craft-focus-title">{focus.name}</p>
              <p>
                Requires L{focus.craftLevel} · {focus.recipe.gold ?? craftGoldCost(focus.craftLevel)} gold · yields{" "}
                {craftOutputQty(focus)}
              </p>
              <p className="wiki-mats">{formatRecipe(focus)}</p>
              {onOpenItem ? (
                <button type="button" className="wiki-link wiki-craft-jump" onClick={() => onOpenItem(focus.id)}>
                  Open in item wiki
                </button>
              ) : null}
            </>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

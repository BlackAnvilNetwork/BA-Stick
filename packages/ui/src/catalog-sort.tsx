import type { CatalogSort } from "./catalog-tree";

type Props = {
  value: CatalogSort;
  onChange: (sort: CatalogSort) => void;
};

/** A–Z vs craft level (items without level sort last). */
export function CatalogSortToggle({ value, onChange }: Props) {
  return (
    <div className="prov-sort-row">
      <span className="cmd-section-label">Sort</span>
      <div className="cmd-seg" role="group" aria-label="Sort items">
        <button type="button" className={value === "name" ? "on" : undefined} onClick={() => onChange("name")}>
          A–Z
        </button>
        <button type="button" className={value === "level" ? "on" : undefined} onClick={() => onChange("level")}>
          Level
        </button>
      </div>
    </div>
  );
}

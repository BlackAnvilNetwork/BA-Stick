import { useState, type ReactNode } from "react";
import { LORE_PAGES } from "./wiki-lore";

export function WikiLorePanel() {
  const [key, setKey] = useState(LORE_PAGES[0]!.key);
  const page = LORE_PAGES.find((p) => p.key === key) ?? LORE_PAGES[0]!;
  const items: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      items.push(
        <ul key={`l${items.length}`} className="wiki-lore-list">
          {list.map((t, i) => <li key={i}>{t}</li>)}
        </ul>,
      );
      list = [];
    }
  };
  page.lines.forEach((line, i) => {
    if (line.startsWith("- ")) return void list.push(line.slice(2));
    flush();
    if (line.startsWith("> ")) items.push(<blockquote key={i} className="wiki-lore-quote">{line.slice(2)}</blockquote>);
    else items.push(<p key={i}>{line}</p>);
  });
  flush();
  return (
    <div className="wiki-lore">
      <div className="wiki-lore-tabs" role="tablist" aria-label="Lore pages">
        {LORE_PAGES.map((p) => (
          <button
            key={p.key}
            type="button"
            role="tab"
            aria-selected={p.key === page.key}
            className={`wiki-lore-tab${p.key === page.key ? " is-active" : ""}`}
            onClick={() => setKey(p.key)}
          >
            {p.title}
          </button>
        ))}
      </div>
      <article className="wiki-lore-page" role="tabpanel">
        <h4 className="wiki-lore-title">{page.title}</h4>
        {items}
      </article>
    </div>
  );
}

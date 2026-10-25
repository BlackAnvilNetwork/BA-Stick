#!/usr/bin/env python3
"""Regenerate catalog.generated.ts (+ weapon tokens) from catalog.json UTF-8."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG_JSON = ROOT / "packages" / "items" / "src" / "catalog.json"
OUT_TS = ROOT / "packages" / "items" / "src" / "catalog.generated.ts"
OUT_WEAPON = ROOT / "packages" / "combat" / "src" / "weapon-tokens.generated.ts"


def main() -> None:
    cat: list[dict] = json.loads(CATALOG_JSON.read_text(encoding="utf-8"))
    body = json.dumps(cat, indent=2, ensure_ascii=False)
    lines = [
        "/* eslint-disable */",
        "/** Auto-generated — do not edit by hand. */",
        "/** Source: packages/items/src/catalog.json */",
        'import type { ItemDef } from "./types";',
        "",
        f"export const CATALOG: ItemDef[] = {body} as ItemDef[];",
        "",
        "export const CATALOG_BY_ID: Record<number, ItemDef> = Object.fromEntries(",
        "  CATALOG.map((i) => [i.id, i]),",
        ") as Record<number, ItemDef>;",
        "",
        "export const CATALOG_BY_SLUG: Record<string, ItemDef> = Object.fromEntries(",
        "  CATALOG.map((i) => [i.slug, i]),",
        ") as Record<string, ItemDef>;",
        "",
    ]
    OUT_TS.write_text("\n".join(lines), encoding="utf-8")

    token_lines = [
        "/* eslint-disable */",
        "/** Auto-generated from item catalog — main-hand tokenId → weapon family. */",
        'import type { WeaponType } from "./weapon-tp";',
        "",
        "export const WEAPON_TOKEN_TYPES: Record<number, WeaponType> = {",
    ]
    for it in cat:
        wf = it.get("weaponFamily")
        if wf and it.get("slot") == "main":
            token_lines.append(f'  {it["id"]}: "{wf}", // {it["slug"]}')
    token_lines += ["} as const;", ""]
    OUT_WEAPON.write_text("\n".join(token_lines), encoding="utf-8")
    print(f"synced {len(cat)} items -> {OUT_TS.name}")


if __name__ == "__main__":
    main()

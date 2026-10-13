#!/usr/bin/env python3
"""Generate contracts/lok-log/engine/src/craft_recipe_data.rs from catalog.json."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "packages" / "items" / "src" / "catalog.json"
OUT = ROOT / "contracts" / "lok-log" / "engine" / "src" / "craft_recipe_data.rs"

SKILL = {
    s: i + 1
    for i, s in enumerate(
        [
            "smithing",
            "woodworking",
            "leathercraft",
            "clothcraft",
            "bonecraft",
            "goldsmithing",
            "alchemy",
            "cooking",
        ]
    )
}


def main() -> None:
    cat = json.loads(CATALOG.read_text())
    name_to_slug: dict[str, str] = {}
    for it in cat:
        key = it["name"].strip().lower()
        name_to_slug.setdefault(key, it["slug"])
        bare = re.sub(r"×\d+$", "", key).strip()
        name_to_slug.setdefault(bare, it["slug"])

    def has_mats(text: str) -> bool:
        for and_slot in text.split(","):
            for opt in re.split(r"\bor\b", and_slot, flags=re.I):
                opt = opt.strip()
                if not opt:
                    continue
                m = re.match(r"(.+?)\s*[×x]\s*(\d+)\s*$", opt, re.I)
                name = (m.group(1) if m else opt).strip().lower()
                slug = name_to_slug.get(name) or name_to_slug.get(re.sub(r"×\d+$", "", name).strip())
                if slug:
                    return True
        return False

    rows = []
    for it in cat:
        if not it.get("recipe") or not it.get("craftSkill") or it.get("craftLevel") is None:
            continue
        text = it["recipe"].get("materialsText") or ""
        if not has_mats(text):
            continue
        rows.append(
            (
                it["id"],
                SKILL[it["craftSkill"]],
                int(it["craftLevel"]),
                int(it.get("craftOutputQty") or 1),
            )
        )
    rows.sort()

    lines = [
        "//! Auto-generated from packages/items/src/catalog.json — do not edit by hand.",
        "//! Regenerate: python3 scripts/gen-craft-recipes.py",
        "",
        "/// skill_id index: 1=smithing … 8=cooking (see skill_label).",
        "#[derive(Clone, Copy, Debug)]",
        "pub struct CraftRecipe {",
        "    pub item_id: u64,",
        "    pub skill: u8,",
        "    pub level: u16,",
        "    pub output_qty: u16,",
        "}",
        "",
        "pub const CRAFT_RECIPES: &[CraftRecipe] = &[",
    ]
    for item_id, skill, level, out_qty in rows:
        lines.append(
            f"    CraftRecipe {{ item_id: {item_id}, skill: {skill}, level: {level}, output_qty: {out_qty} }},"
        )
    lines += [
        "];",
        "",
        "pub fn craft_recipe(item_id: u64) -> Option<CraftRecipe> {",
        "    let mut lo = 0usize;",
        "    let mut hi = CRAFT_RECIPES.len();",
        "    while lo < hi {",
        "        let mid = (lo + hi) / 2;",
        "        let r = CRAFT_RECIPES[mid];",
        "        if r.item_id < item_id { lo = mid + 1; }",
        "        else if r.item_id > item_id { hi = mid; }",
        "        else { return Some(r); }",
        "    }",
        "    None",
        "}",
        "",
        "pub fn skill_label(skill: u8) -> Option<&'static str> {",
        "    match skill {",
    ]
    for s, i in SKILL.items():
        lines.append(f'        {i} => Some("{s}"),')
    lines += ["        _ => None,", "    }", "}", ""]
    OUT.write_text("\n".join(lines))
    print(f"craft_recipe_data.rs: {len(rows)} recipes")


if __name__ == "__main__":
    main()

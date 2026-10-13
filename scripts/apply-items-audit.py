#!/usr/bin/env python3
"""Apply Black Anvil items audit + CSV proposals to packages/items/src/catalog.json.

Also regenerates catalog.generated.ts from the JSON (no xlsx dependency).
"""
from __future__ import annotations

import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "packages" / "items" / "src" / "catalog.json"
OUT_TS = ROOT / "packages" / "items" / "src" / "catalog.generated.ts"
CSV = Path("/home/ubuntu/.cursor/projects/workspace/uploads/black-anvil-items-proposal_bc76.csv")

LIVE_BASE_SLUGS = [
    "antidote-root",
    "ashbeam-log",
    "bark-strip",
    "bone-chip",
    "clay-crab",
    "climbing-cord",
    "cobble",
    "copper-ore",
    "cracked-brick",
    "dead-fiber",
    "desiccated-hide",
    "dustgrain",
    "fossil-minnow",
    "horn",
    "limestone",
    "linen-scrap",
    "pale-dust",
    "pale-flax",
    "potters-clay",
    "river-sand",
    "rock-salt",
    "slime-oil",
    "soft-pelt",
    "tin-ore",
]

RARITY_FROM_LEVEL = lambda lv: (
    "Common" if lv < 25 else "Uncommon" if lv < 50 else "Rare" if lv < 80 else "Epic"
)


def craft_gold(level: int | None) -> int:
    if level is None:
        return 50
    return 50 + 20 * int(level)


def parse_proposed(s: str) -> dict | None:
    s = (s or "").strip()
    if not s:
        return None
    return json.loads(s)


def used_material_names(cat: list[dict]) -> set[str]:
    used: set[str] = set()
    for it in cat:
        text = (it.get("recipe") or {}).get("materialsText") or ""
        for part in re.split(r",|\bor\b", text):
            part = part.strip()
            if not part:
                continue
            m = re.match(r"(.+?)(?:×\d+)?$", part)
            if m:
                used.add(m.group(1).strip())
    return used


def main() -> None:
    cat: list[dict] = json.loads(CATALOG.read_text())
    by_id = {it["id"]: it for it in cat}

    # ── CSV proposals (103) ─────────────────────────────────────────────
    with CSV.open(newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    applied = 0
    for row in rows:
        prop = parse_proposed(row.get("proposed") or "")
        if prop is None:
            # still stamp rarity
            it = by_id.get(int(row["id"]))
            if it and it.get("kind") == "equipment":
                lv = it.get("craftLevel") or int(row["craftLevel"] or 0)
                it["rarity"] = row.get("rarity") or RARITY_FROM_LEVEL(lv)
            continue
        it = by_id[int(row["id"])]
        it["stats"] = prop
        lv = it.get("craftLevel") or int(row["craftLevel"] or 0)
        it["rarity"] = row.get("rarity") or RARITY_FROM_LEVEL(lv)
        if it["id"] == 304:
            # Copper Collar → earring
            it["slot"] = "earring"
            it.pop("weaponFamily", None)
            it.pop("twoHand", None)
            it.pop("delayMs", None)
        applied += 1

    # Stamp rarity on remaining equipment
    for it in cat:
        if it.get("kind") == "equipment" and "rarity" not in it:
            it["rarity"] = RARITY_FROM_LEVEL(it.get("craftLevel") or 0)

    # ── Fishing rods: not staves ────────────────────────────────────────
    for it in cat:
        if "fishing-rod" in it.get("slug", ""):
            it.pop("weaponFamily", None)

    # ── Caster books: staff family for spell gate ───────────────────────
    for iid in (59, 60):
        by_id[iid]["weaponFamily"] = "staff"

    # ── Pack output qty from ×N in name ─────────────────────────────────
    for it in cat:
        m = re.search(r"×(\d+)\s*$", it.get("name") or "")
        if m:
            it["craftOutputQty"] = max(1, int(m.group(1)))

    # ── Scale gold on all recipes ───────────────────────────────────────
    for it in cat:
        if it.get("recipe"):
            it["recipe"]["gold"] = craft_gold(it.get("craftLevel"))

    # ── Dead-end fillers: strip recipes (keep 11 that feed other crafts) ─
    used = used_material_names(cat)
    stripped = 0
    for it in cat:
        if it.get("kind") != "filler" or not it.get("recipe"):
            continue
        name = it["name"]
        bare = re.sub(r"×\d+$", "", name).strip()
        if name in used or bare in used:
            continue
        del it["recipe"]
        stripped += 1

    # ── Rogue Bone Dagger craftable in Pale Hollow ──────────────────────
    bone = by_id[317]
    bone["recipe"] = {
        "gold": craft_gold(bone.get("craftLevel") or 8),
        "materialsText": "Bone Chip×2, Soft Pelt×1, Pale Dust×1",
    }
    bone["obtainedFrom"] = "Craft — Bone Chip (Pale Hollow)"

    # ── Cleric Ashbeam Club craftable with live mats ────────────────────
    club = by_id[183]
    club["craftLevel"] = 12
    club["recipe"] = {
        "gold": craft_gold(12),
        "materialsText": "Ashbeam Lumber×2, Soft Pelt×1, Pale Dust×1",
    }
    club["rarity"] = "Common"

    # ── Heart Ring [Rare] ───────────────────────────────────────────────
    if 1063 not in by_id:
        heart = {
            "id": 1063,
            "name": "Heart Ring",
            "description": "Heart Ring. A rare goldsmith's work that steadies the pulse.",
            "icon": "/icons/items/heart-ring.png",
            "slug": "heart-ring",
            "kind": "equipment",
            "craftLevel": 55,
            "craftSkill": "goldsmithing",
            "recipe": {
                "gold": craft_gold(55),
                "materialsText": "Copper Ore×2, Soft Pelt×1, Pale Dust×1",
            },
            "stats": {"regen": 1, "healPotency": 5, "atk": 6},
            "slot": "ring",
            "jobRestrict": "all",
            "rarity": "Rare",
            "obtainedFrom": "Craft — goldsmithing",
        }
        cat.append(heart)
        by_id[1063] = heart

    # ── obtainedFrom touch-ups for live mats ────────────────────────────
    live_notes = {
        "bark-strip": "Gather — Pale Hollow Ashbeam Logs",
        "horn": "Drop — Pale Hollow beasts",
        "rock-salt": "Mine — Pale Hollow limestone",
        "tin-ore": "Mine / Drop — Pale Hollow",
        "copper-ore": "Mine / Drop — Pale Hollow",
        "cracked-brick": "Drop — Ruin Dweller",
        "desiccated-hide": "Drop — Pale Hollow beasts",
    }
    for slug, note in live_notes.items():
        for it in cat:
            if it.get("slug") == slug:
                it["obtainedFrom"] = note

    cat.sort(key=lambda x: x["id"])
    CATALOG.write_text(json.dumps(cat, indent=2, ensure_ascii=False) + "\n")
    write_ts(cat)
    print(f"applied_proposals={applied} stripped_filler_recipes={stripped} items={len(cat)}")
    print(f"live_base_slugs={len(LIVE_BASE_SLUGS)}")


def write_ts(cat: list[dict]) -> None:
    body = json.dumps(cat, indent=2, ensure_ascii=False)
    # JSON uses double quotes; valid as TS object literals for our data shape.
    OUT_TS.write_text(
        "/* eslint-disable */\n"
        "/** Auto-generated by scripts/apply-items-audit.py — do not edit by hand. */\n"
        "/** Source: packages/items/src/catalog.json (audit-patched). */\n"
        'import type { ItemDef } from "./types";\n\n'
        f"export const CATALOG: ItemDef[] = {body};\n\n"
        "export const CATALOG_BY_ID: Record<number, ItemDef> = Object.fromEntries(\n"
        "  CATALOG.map((i) => [i.id, i]),\n"
        ");\n\n"
        "export const CATALOG_BY_SLUG: Record<string, ItemDef> = Object.fromEntries(\n"
        "  CATALOG.map((i) => [i.slug, i]),\n"
        ");\n"
    )


if __name__ == "__main__":
    main()

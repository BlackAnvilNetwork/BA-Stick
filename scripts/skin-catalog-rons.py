"""Copy family RONs for catalog gear that should have one, and skin plates from the item name."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = json.loads((ROOT / "packages/items/src/catalog.json").read_text(encoding="utf-8"))
GEAR = ROOT / "engine/ba-stick-render/assets/gear"
WIKI = ROOT / "apps/stick-web/src/wiki-gear.ts"
SPEC = ROOT / "scripts/_non-smith-gear-ron-spec.json"

VISIBLE = {"head", "body", "hands", "legs", "feet", "main", "sub", "ranged", "grip"}
ROW_RE = re.compile(r'"([.grckbmdlhseiown]+)"')
MAT_RE = re.compile(r'material: Some\("[^"]+"\)')

# Longer / more specific needles first.
SKIN_NEEDLES: list[tuple[str, str]] = [
    ("orichalcum", "gold"),
    ("crownplate", "gold"),
    ("crownsteel", "gold"),
    ("crowntarge", "gold"),
    ("palace", "gold"),
    ("voidbraid", "dusk"),
    ("voidhide", "darkhide"),
    ("voidplate", "dark"),
    ("voidtarge", "dark"),
    ("voidguard", "dark"),
    ("voidoak", "wood"),
    ("nightweave", "dusk"),
    ("nighweave", "dusk"),
    ("duskweave", "dusk"),
    ("nighthide", "darkhide"),
    ("hexweave", "dusk"),
    ("hexflax", "dusk"),
    ("hexplate", "dark"),
    ("spellbraid", "dusk"),
    ("aetherweave", "silk"),
    ("aetherplate", "white"),
    ("aethertarge", "mythril"),
    ("aetherhide", "leather"),
    ("altarweave", "silk"),
    ("throneweave", "gold"),
    ("battleweave", "silk"),
    ("glenweave", "silk"),
    ("quillweave", "silk"),
    ("ringweave", "undyed"),
    ("horncloth", "undyed"),
    ("seedcloth", "undyed"),
    ("palecloth", "undyed"),
    ("forgecloth", "undyed"),
    ("fordcloth", "undyed"),
    ("kilnflax", "undyed"),
    ("reedcloth", "undyed"),
    ("flaxcord", "undyed"),
    ("wickreed", "undyed"),
    ("wicklinen", "undyed"),
    ("dustweave", "undyed"),
    ("cinderflax", "undyed"),
    ("forgeplate", "bronze"),
    ("copperbind", "bronze"),
    ("rivetmail", "iron"),
    ("ironbind", "iron"),
    ("ashbind", "iron"),
    ("runeplate", "iron"),
    ("pitiron", "iron"),
    ("darksteel", "dark"),
    ("mythril", "mythril"),
    ("bronze", "bronze"),
    ("copper", "bronze"),
    ("steel", "iron"),
    ("iron", "iron"),
    ("crownbone", "bone"),
    ("ashbone", "bone"),
    ("marshbone", "bone"),
    ("riverbone", "bone"),
    ("coilbone", "bone"),
    ("skull", "bone"),
    ("bone", "bone"),
    ("slaghide", "darkhide"),
    ("coilhide", "darkhide"),
    ("dusthide", "leather"),
    ("briarhide", "leather"),
    ("seamhide", "leather"),
    ("pitcord", "leather"),
    ("dustcord", "leather"),
    ("driftpelt", "leather"),
    ("leather", "leather"),
    ("hide", "leather"),
    ("velvet", "silk"),
    ("silk", "silk"),
    ("linen", "undyed"),
    ("seedwood", "wood"),
    ("paleoak", "wood"),
    ("forgeoak", "wood"),
    ("runeoak", "wood"),
    ("ashbeam", "wood"),
    ("bellwood", "wood"),
    ("bloodbeam", "wood"),
    ("oak", "wood"),
    ("seedguard", "iron"),
    ("paletarge", "mythril"),
    ("rivettarge", "iron"),
    ("pitguard", "iron"),
    ("forgetarge", "bronze"),
    ("fordtarge", "iron"),
    ("kilntarge", "iron"),
    ("reedtarge", "iron"),
    ("forgeguard", "bronze"),
    ("glentarge", "iron"),
    ("quilltarge", "iron"),
]

SKINS: dict[str, dict] = {
    "gold": {
        "plate": {"e": "g", "i": "g", "o": "g", "k": "e", "b": "g", "m": "g", "c": "e", "l": "g", "d": "e", "w": "g", "h": "g", "s": "e"},
        "mat": "steel",
    },
    "dark": {
        "plate": {"e": "k", "o": "k", "g": "i", "b": "k", "m": "c", "l": "k", "d": "c", "w": "k", "h": "k", "s": "i"},
        "mat": "steel",
    },
    "bronze": {
        "plate": {"e": "o", "i": "o", "k": "o", "b": "o", "m": "o", "l": "o", "d": "o", "w": "o", "h": "o", "s": "o"},
        "mat": "steel",
    },
    "mythril": {
        "plate": {"e": "n", "g": "w", "o": "n", "i": "m", "k": "m", "r": "n", "b": "n", "l": "n", "d": "w"},
        "mat": "steel",
    },
    "white": {
        "plate": {"e": "w", "i": "w", "o": "w", "k": "e", "b": "w", "m": "w", "l": "w", "d": "g"},
        "mat": "steel",
    },
    "iron": {"plate": {"o": "e", "w": "e", "b": "e", "m": "g"}, "mat": "steel"},
    "undyed": {"plate": {"b": "l", "m": "l", "c": "d", "k": "d", "e": "l", "o": "l", "g": "d", "w": "l"}, "mat": "dust"},
    "dusk": {"plate": {"b": "k", "m": "n", "l": "k", "d": "c", "e": "k", "o": "k", "w": "k", "h": "k"}, "mat": "dust"},
    "silk": {"plate": {"l": "b", "d": "c", "e": "b", "o": "b", "w": "b"}, "mat": "dust"},
    "leather": {"plate": {"e": "l", "b": "l", "m": "d", "o": "l", "w": "l", "h": "l", "s": "d"}, "mat": "leather"},
    "darkhide": {"plate": {"l": "d", "d": "k", "e": "d", "b": "d", "m": "k", "o": "d", "w": "d", "h": "d", "s": "k"}, "mat": "leather"},
    "bone": {"plate": {"l": "h", "d": "s", "e": "h", "b": "h", "o": "h", "w": "h", "g": "s"}, "mat": "bone"},
    "wood": {"plate": {"e": "l", "o": "l", "b": "l", "w": "l"}, "mat": "dust"},
}

SKILL_SKIN = {
    "smithing": "iron",
    "clothcraft": "undyed",
    "leathercraft": "leather",
    "bonecraft": "bone",
    "woodworking": "wood",
    "goldsmithing": "gold",
}


def hay(item: dict) -> str:
    return (item.get("name", "") + " " + item.get("slug", "").replace("-", " ")).lower()


def pick_skin(item: dict) -> str:
    h = hay(item)
    for needle, skin in SKIN_NEEDLES:
        if needle in h:
            return skin
    return SKILL_SKIN.get(item.get("craftSkill") or "", "iron")


def template_for(item: dict) -> str:
    slug = item["slug"]
    skill = item.get("craftSkill") or ""
    slot = item["slot"]
    fam = item.get("weaponFamily") or ""
    last = slug.split("-")[-1]
    h = hay(item)

    if slot == "main":
        if fam == "dagger" or last in ("dagger", "kris"):
            return "ba_iron_dagger"
        if fam == "greatsword" or "greatsword" in slug:
            return "ba_iron_greatsword"
        if fam == "axe" or last == "axe":
            return "ba_steel_great_axe" if "great" in slug else "ba_iron_axe"
        if last in ("wand", "rod") and "fishing" not in slug:
            return "ba_ashbeam_rod"
        if last == "tome":
            return "ba_ashbeam_tome"
        if fam == "staff" or last in ("staff", "quarterstaff", "crook", "crozier"):
            return "ba_ashbeam_staff"
        if fam == "club" or last in ("club", "mace", "cudgel"):
            return "ba_ashbeam_club"
        if fam == "knuckles" or last == "knuckles":
            return "ba_iron_dagger"
        if fam == "sword" or last in ("sword", "shortsword", "blade"):
            return "ba_iron_sword"
        return "ba_iron_sword"

    if slot == "sub":
        return "ba_iron_shield"

    if slot == "ranged":
        return "ba_war_bow"

    if slot == "grip":
        return "ba_ashbeam_grip"

    if slot == "head":
        if last in ("torque", "circlet") or "torque" in slug or "circlet" in slug:
            return "ba_circlet"
        if last == "bandana" or skill == "leathercraft" and last in ("cap", "coif"):
            return "ba_leather_bandana"
        if skill == "bonecraft" or "bone" in slug or last == "skull":
            return "ba_bone_helm"
        if last in ("helm", "sallet") or skill == "smithing":
            return "ba_iron_helm"
        if last in ("hood", "cowl"):
            return "ba_linen_helm"
        if last in ("hat", "cap"):
            return "ba_silk_hat" if skill == "clothcraft" else "ba_leather_bandana"
        return "ba_silk_hat"

    if slot == "body":
        if last == "breastplate":
            return "ba_mythril_breastplate"
        if last in ("mail", "cuirass", "plate") or skill == "smithing":
            return "ba_steel_mail"
        if last == "harness" or skill == "bonecraft":
            return "ba_bone_harness"
        if last in ("vest", "jerkin", "jack") or skill == "leathercraft":
            return "ba_leather_vest"
        if last in ("coat", "raiment", "shirt"):
            return "ba_battleweave_coat"
        return "ba_linen_robe"

    if slot == "hands":
        if last in ("mittens", "gauntlets") or skill == "smithing":
            return "ba_steel_mittens"
        if skill == "bonecraft" or "bone" in slug:
            return "ba_bone_gloves"
        if last == "bracer" or skill == "leathercraft":
            return "ba_leather_gloves"
        if last in ("cuffs", "wraps"):
            return "ba_linen_cuffs"
        return "ba_battleweave_gloves"

    if slot == "legs":
        if last in ("cuisses", "leggings", "subligar") or skill == "smithing":
            return "ba_iron_cuisses"
        if skill == "bonecraft" or "bone" in slug:
            return "ba_bone_trousers"
        if last in ("chaps", "trousers") or skill == "leathercraft":
            return "ba_leather_trousers"
        return "ba_linen_slops"

    if slot == "feet":
        if last in ("sabatons",) or skill == "smithing":
            return "ba_steel_sabatons"
        if skill == "bonecraft" or ("bone" in slug and last in ("boots", "greaves")):
            return "ba_bone_boots"
        if last == "socks":
            return "ba_linen_socks"
        if last in ("pumps", "slippers", "shoes"):
            return "ba_silk_pumps"
        if last == "sandals":
            return "ba_leather_sandals"
        if last in ("boots", "greaves"):
            return "ba_shade_leather_boots" if skill == "leathercraft" else "ba_bone_boots"
        return "ba_silk_pumps"

    raise ValueError(f"no template for {slot} {slug}")


def remap_rows(text: str, mapping: dict[str, str]) -> str:
    if not mapping:
        return text

    def repl(m: re.Match[str]) -> str:
        return '"' + "".join(mapping.get(ch, ch) for ch in m.group(1)) + '"'

    return ROW_RE.sub(repl, text)


def write_skinned(src_id: str, dest_id: str, skin: str, name: str) -> None:
    src_ron = GEAR / f"{src_id}.ron"
    if not src_ron.exists():
        raise FileNotFoundError(src_ron)
    cfg = SKINS[skin]
    text = src_ron.read_text(encoding="utf-8")
    text = text.replace(src_id, dest_id)
    text = MAT_RE.sub(f'material: Some("{cfg["mat"]}")', text)
    (GEAR / f"{dest_id}.ron").write_text(text, encoding="utf-8")

    src_plate = GEAR / f"{src_id}.plate.ron"
    dest_plate = GEAR / f"{dest_id}.plate.ron"
    if src_plate.exists():
        p = src_plate.read_text(encoding="utf-8")
        p = p.replace(src_id, dest_id)
        p = remap_rows(p, cfg["plate"])
        dest_plate.write_text(p, encoding="utf-8")
    elif dest_plate.exists():
        dest_plate.unlink()


def dest_id(slug: str) -> str:
    return "ba_" + slug.replace("-", "_")


def rewrite_wiki_ids() -> int:
    ids = sorted(p.stem for p in GEAR.glob("ba_*.ron") if not p.name.endswith(".plate.ron"))
    body = ",\n".join(f'  "{i}"' for i in ids)
    src = WIKI.read_text(encoding="utf-8")
    new, n = re.subn(
        r"export const GEAR_RON_IDS = new Set\(\[[\s\S]*?\]\);",
        f"export const GEAR_RON_IDS = new Set([\n{body},\n]);",
        src,
        count=1,
    )
    if n != 1:
        raise RuntimeError("GEAR_RON_IDS block not found")
    WIKI.write_text(new, encoding="utf-8")
    return len(ids)


def tracked_gear_ids() -> set[str]:
    import subprocess

    out = subprocess.check_output(
        ["git", "ls-files", "engine/ba-stick-render/assets/gear"],
        cwd=ROOT,
        text=True,
    )
    ids = set()
    for line in out.splitlines():
        name = Path(line).name
        if name.endswith(".plate.ron"):
            continue
        if name.endswith(".ron"):
            ids.add(name[: -len(".ron")])
    return ids


def main() -> None:
    created = 0
    reskinned = 0
    missing_now = []
    tracked = tracked_gear_ids()
    copy_dests: set[str] = set()
    copy_src: dict[str, str] = {}
    if SPEC.exists():
        spec = json.loads(SPEC.read_text(encoding="utf-8"))
        for band in spec.get("bands", {}).values():
            for piece in band.get("visible", []):
                did = dest_id(piece["slug"])
                copy_dests.add(did)
                copy_src[did] = piece["copyRon"]

    for item in CATALOG:
        if item.get("kind") != "equipment" or item.get("slot") not in VISIBLE:
            continue
        did = dest_id(item["slug"])
        path = GEAR / f"{did}.ron"
        skin = pick_skin(item)
        src = copy_src.get(did) or template_for(item)
        exists = path.exists()
        # Mail arms are hand-tinted white; do not reset from the steel template.
        if did == "ba_aetherplate_mail" and exists:
            continue
        if exists and did in tracked and did not in copy_dests:
            continue
        write_skinned(src, did, skin, item["name"])
        if exists:
            reskinned += 1
        else:
            created += 1

    for item in CATALOG:
        if item.get("kind") != "equipment" or item.get("slot") not in VISIBLE:
            continue
        if not (GEAR / f"{dest_id(item['slug'])}.ron").exists():
            missing_now.append(item["slug"])

    total = rewrite_wiki_ids()
    print("created", created)
    print("reskinned-copies", reskinned)
    print("gear-ron-ids", total)
    print("still-missing", len(missing_now), missing_now[:20])


if __name__ == "__main__":
    main()

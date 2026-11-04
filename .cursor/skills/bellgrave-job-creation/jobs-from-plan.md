---
name: jobs-from-plan
description: >-
  Locked Bellgrave job designs from the original plan — grades, spells, JAs,
  role chart, and FX motifs. Use with bellgrave-job-creation when implementing
  Knight, Rogue, Cleric, Sorcerer, Fighter, or Battle Mage.
---

# Bellgrave jobs — design lock (from plan)

Implement these as **full original jobs**. Time Mage detail lives in [reference-time-mage.md](reference-time-mage.md) + combat `tim-kit.ts`. Cap **75** all jobs.

## Roster

| ID | Job | Fantasy | Primary stats | Implement phase |
|----|-----|---------|---------------|-----------------|
| 1 | Knight | Shield tank | VIT, STR | V3 |
| 2 | Rogue | Crit / evasion | DEX, AGI | V3 |
| 3 | Cleric | Primary healer | MND, VIT | V3 |
| 4 | Sorcerer | Elemental DPS | INT | V3 |
| 5 | Fighter | Physical DPS | STR, DEX | V3 |
| 6 | Battle Mage | Sword + elemental hybrid | STR, INT | V3 |
| 7 | Time Mage | Tempo + Flux MND staff | MND, AGI, INT | v1 (live) |
| 8 | Druid | Ring-Walker shapeshift flex | MND, VIT | planned (append-only) |

### Shared rules

- Each job has a **2HR at Lv1** (2 h recast).  
- Weapons gated by job skill ranks.  
- Ideal party core: Knight + Cleric + Fighter/Rogue + Sorcerer/Battle Mage + Time Mage (+ flex).

### Role chart (do not blur)

| Need | Best | Backup |
|------|------|--------|
| Tank hate | Knight | Fighter Provoke |
| Healing / Raise / -na | Cleric | Battle Mage Cure; TIM Cure weak |
| Tempo haste + movespeed | **Time Mage** | Cleric/Battle Mage Haste (weaker) |
| Enfeeble AoEs / Dispelga | **Time Mage** | Battle Mage single targets |
| Elemental DPS | Sorcerer | Battle Mage |
| Physical DPS | Fighter | Rogue burst |
| Evasion scout | Rogue | — |
| Refresh | Battle Mage | — |
| Flex shapeshift | — | **Druid** (backup of each role, never Best) |

---

## 4.1 Knight — shield tank

**Fantasy:** Frontliner who holds enmity, blocks with shield, spot-heals. Not a DPS.

**Grades:** HP **A**, MP **E**, STR **B**, DEX **D**, VIT **A**, AGI **E**, INT **E**, MND **C**

**Skills:** Sword **A+**, Club **B**, Great Sword **B**, Shield **A+**, Parrying **B**, Evasion **C**, Divine **C**, Healing **D**, Enhancing **D**

**Traits (design):** Defense Bonus line, Shield Mastery, Max HP Boost, modest Attack Bonus, light Clear Mind

**Spells (sparse divine):**

| Lv | Spell |
|----|-------|
| 5 | Cure |
| 7 | Banish |
| 17 | Protect |
| 20 | Flash (blind + high enmity) |
| 30 | Cure II |
| 34 | Shell |
| 37 | Protect II |
| 45 | Cure III |
| 47 | Shell II |
| 55 | Protect III |
| 57 | Shell III |
| 65 | Cure IV |
| 70 | Banish II |
| 75 | Holy (single nuke, high enmity) |

**Job abilities:**

| Lv | Ability | Recast | Effect |
|----|---------|--------|--------|
| 1 | **Bulwark** (2HR) | 2 h | 30s physical damage taken −100% (magic still hits) |
| 5 | Provoke | 30s | Spike enmity on target |
| 15 | Shield Bash | 60s | Stun + shield damage |
| 25 | Cover | 3 min | Take hits for party member 15s |
| 35 | Rampart | 5 min | Party physical DT −25% for 30s |
| 45 | Sentinel | 5 min | Self DT −50%, enmity+ 30s |
| 55 | Fealty | 10 min | Strong magic defense / resist 60s |
| 65 | Chivalry | 10 min | Convert TP → MP |
| 75 | Guardian | 20 min | Cover entire party 20s |

**Style:** Heavy plate, shield + sword; steel/charcoal/crimson; modest cape. Seed `bellgrave-93471-knight`.  
**FX motifs:** Silver flash, crimson shield, holy pale-gold — **not** Cleric sky-blue, **not** TIM teal.

**Play:** Sword + shield. Flash/Provoke hold hate.

---

## 4.2 Rogue — evasion / crit

**Fantasy:** High evasion, burst windows, utility openers. Light armor.

**Grades:** HP **D**, MP **—** (none), STR **C**, DEX **A**, VIT **D**, AGI **A**, INT **D**, MND **E**

**Skills:** Dagger **A+**, Sword **B**, Throwing **B**, Evasion **A+**, Parrying **A**

**Traits:** Critical Attack Bonus, Evasion Bonus, Triple Attack (late), Treasure Hunter, Gilfinder (Dust+)

**No native spells.** No spellbook UI.

**Job abilities:**

| Lv | Ability | Recast | Effect |
|----|---------|--------|--------|
| 1 | **Ghost Step** (2HR) | 2 h | 30s all melee swings against you miss |
| 5 | Steal | 5 min | Attempt steal Dust/item |
| 15 | Sneak Attack | 1 min | Next hit crit + DEX WSC |
| 25 | Flee | 5 min | Move +50% 30s |
| 30 | Trick Attack | 1 min | Next hit transfers enmity to front ally |
| 40 | Mug | 15 min | Steal HP |
| 50 | Accomplice / Collaborator | 5 min | Pass enmity to ally |
| 60 | Assassin’s Charge | 5 min | Next WS +crit / TP refund |
| 75 | Feint | 2 min | Enemy Eva −50 for 30s |

**Style:** Light armor, daggers; deep purple/brown/black; hood/scarf/pouches. Seed `bellgrave-93471-rogue`.  
**FX motifs:** Violet smoke, cut lines — **no** big magic circles.

**Play:** Dagger. SA+TA spike. Ghost Step for survival.

---

## 4.3 Cleric — primary healer

**Fantasy:** Best cures, status removal, Raise. Soft defense buffs. Weak melee.

**Grades:** HP **E**, MP **B**, STR **D**, DEX **E**, VIT **C**, AGI **D**, INT **D**, MND **A**

**Skills:** Club **B**, Staff **C**, Healing **A+**, Divine **A**, Enhancing **B**, Enfeebling **D**, Evasion **D**

**Traits:** Clear Mind, Max MP, Magic Defense Bonus, Auto Regen (late), Divine Veil

**Spells (core lines):**

| Line | Levels (approx) |
|------|-----------------|
| Cure I–V | 1 / 11 / 21 / 41 / 61 |
| Curaga I–III | 16 / 40 / 60 |
| Raise / Raise II / Reraise | 25 / 50 / 33 |
| -na (Poisona, Paralyna, Blindna, Silena, Viruna, Stona, Cursna) | 10–50 |
| Erase | 45 |
| Regen I–III | 21 / 44 / 66 |
| Protect / Shell (+ra) | 10–75 |
| Haste | 40 |
| Banish / Holy | undead tools |
| Slow / Paralyze / Silence | light enfeebles |
| Flash | 45 |

**Job abilities:**

| Lv | Ability | Recast | Effect |
|----|---------|--------|--------|
| 1 | **Sacred Mercy** (2HR) | 2 h | Party full HP + erase most statuses |
| 15 | Divine Seal | 10 min | Next cure/banish ×2 |
| 30 | Solace Rite | toggle | Cures also grant absorb shield |
| 40 | Martyr | 10 min | Sacrifice HP to heal ally |
| 50 | Misery Rite | toggle | Enfeebles empowered after damage taken |
| 60 | Devotion | 10 min | Give MP to ally from your HP |
| 75 | Asylum | 20 min | Party magic DT − 30s |

**Style:** Vestments, mace/staff; white/sky blue/soft gold; bell or broken-sun mark. Seed `bellgrave-93471-cleric`.  
**FX motifs:** White / sky blue / soft gold — Raise = rising light column. Distinct from Knight pale-gold wards.

**Play:** Main healer. Owns Raise / -na.

---

## 4.4 Sorcerer — elemental nuker

**Fantasy:** Black magic DPS. Squishy. Burn windows. Staff.

**Grades:** HP **F**, MP **A**, STR **E**, DEX **C**, VIT **E**, AGI **C**, INT **A**, MND **D**

**Skills:** Staff **A+**, Club **C**, Elemental **A+**, Dark **B**, Enfeebling **C**, Evasion **D**

**Traits:** Magic Attack Bonus, Clear Mind, Conserve MP, Magic Burst Bonus (if skillchains), light Fast Cast

**Spells:** Elemental tiers I–IV for Stone/Water/Aero/Fire/Blizzard/Thunder (+ ga/aja at high levels); Sleep/Sleepga; Blind; Bind; Dispel; Drain/Aspir; Warp/Escape; Stun (Dark).

Example Fire curve: Fire 13, Fire II 38, Fire III 62, Fire IV 73; Firaga 28, Firaga II 53, Firaga III 69.

**Job abilities:**

| Lv | Ability | Recast | Effect |
|----|---------|--------|--------|
| 1 | **Arcane Flood** (2HR) | 2 h | 60s cast without MP cost; uninterruptible |
| 15 | Elemental Seal | 10 min | Next elemental +MACC heavily |
| 30 | Mana Wall | 5 min | HP absorbs magic damage inverse |
| 40 | Manawell | 5 min | Next spell free MP |
| 50 | Enmity Douse | 3 min | Clear self enmity |
| 60 | Cascade | 5 min | Next skillchain/MB window bonus |
| 75 | Focal Neve | 20 min | Self INT +40 / MAB +20 for 60s |

**Style:** Caster robes, staff orb; violet/deep blue/wine; rune hems. Seed `bellgrave-93471-sorcerer`.  
**FX motifs:** Violet/blue + per-element nuke colors. Not Battle Mage teal-bronze.

**Play:** Stand back. Nuke. Arcane Flood burn.

---

## 4.5 Fighter — raw melee DPS

**Fantasy:** Highest physical output, WS focus, two-hander. Minimal magic.

**Grades:** HP **B**, MP **—**, STR **A**, DEX **B**, VIT **C**, AGI **C**, INT **E**, MND **E**

**Skills:** Great Axe **A+**, Axe **A**, Great Sword **A**, Sword **B**, Polearm **B**, Evasion **C**, Parrying **C**

**Traits:** Double Attack, Attack Bonus, Crit Bonus (late), Max HP, modest Store TP

**No native spells.**

**Job abilities:**

| Lv | Ability | Recast | Effect |
|----|---------|--------|--------|
| 1 | **Killing Storm** (2HR) | 2 h | 45s all melee hits critical |
| 5 | Berserk | 5 min | Att +25%, Def −25% for 180s |
| 15 | Warcry | 5 min | Party Att + 30s |
| 25 | Defender | 3 min | Def +, Att − |
| 35 | Aggressor | 5 min | Acc +, Eva − |
| 45 | Provoke | 30s | Enmity spike (off-tank) |
| 55 | Restraint | 10 min | WS TP bonus build |
| 65 | Blood Rage | 10 min | Party crit window |
| 75 | Brazen Rush | 20 min | Double Attack rate surge 30s |

**Style:** Two-hander DPS; iron grey/oxblood/leather; no oversized ceremonial cape. Seed `bellgrave-93471-fighter`.  
**FX motifs:** Iron sparks, blood-red rage — **no** magic circles.

**Play:** Great Axe / GS. Berserk + Killing Storm = peak physical burst.

---

## 4.6 Battle Mage — sword + elemental hybrid

**Fantasy:** Midline caster-melee. En-spells, convert, flexible kit. Not best healer, nuker, or tempo job.

**Grades:** HP **D**, MP **C**, STR **C**, DEX **C**, VIT **D**, AGI **D**, INT **B**, MND **C**

**Skills:** Sword **A**, Club **B**, Dagger **C**, Elemental **B**, Enfeebling **B**, Enhancing **B**, Healing **C**, Dark **D**, Evasion **C**, Shield **C**

**Traits:** Strong Fast Cast, mid MAB, Clear Mind, Sword+Shield default, Convert line

**Spells (hybrid):**

| Role | Spells |
|------|--------|
| En-spells | Flame Edge → Thunder Edge (weapon elemental) |
| Nukes | Elemental I–III (no IV; limited ga) |
| Enfeebles | Dia, Bio, Slow, Paralyze, Silence, Blind, Gravity, Dispel, Bind, Sleep |
| Enhancing | Protect/Shell, Phalanx, Stoneskin, Haste, Refresh (single ~40) |
| Healing | Cure I–IV (weaker than Cleric) |

**Job abilities:**

| Lv | Ability | Recast | Effect |
|----|---------|--------|--------|
| 1 | **Spellblade** (2HR) | 2 h | 60s spells cast 0 / recast 0 (anim lock remains) |
| 15 | Convert | 10 min | Swap HP ↔ MP |
| 25 | Corrupt | 5 min | Next enfeeble potency/duration + |
| 35 | Focus Weave | toggle | Self enhance duration × |
| 45 | Spontaneity | 10 min | Next spell instant |
| 55 | Lockspell | 15 min | Next enfeeble nearly unresistable |
| 65 | Corrupt II / Widen | 10 min | Next enhance becomes AoE |
| 75 | Full Circle | 20 min | Dump en-spell into burst nuke |

**Style:** Gauntlets + tunic/half-robe + sword; teal/steel/bronze. Seed `bellgrave-93471-battlemage`.  
**FX motifs:** Teal-bronze blade runes — distinct from Sorcerer violet and TIM chrona.

**Play:** Sword + en-spell between casts. Refresh support. Spellblade for emergency casts.

---

## 4.7 Time Mage

Full kit implemented — see [reference-time-mage.md](reference-time-mage.md). Grades: HP C, MP C, STR E, DEX C, VIT D, AGI B, INT B, MND B. Dual stances Flux / Aether. Tempo line owns magical haste identity.

---

## 4.8 Druid — shapeshift flex (8th job, append-only)

**Fantasy:** A Ring-Walker borrows one leftover creature-song from an out-of-tune henge — one body at a time — and never owns the role that body suggests. Seed `bellgrave-93471-druid`.

**Feel:** Shift, then play that form’s short bar. Human is the hub and a weak singer, not a fifth combat stance.

**Append only:** `"druid"` is job index 7 on `JOB_IDS`. Do not insert mid-list.

**Locked calls:** 85-node Henge island at the center of the skill web (do not reslice the seven). Druid is never a support job. Forms persist across zones and through unequip; drop only on death, job change, or (Racerunner) damage / combat ability. Rest in every form. Talk / craft / gather / Job Master / warp while shifted.

### Forms

| Role | Name | Body | Notes |
|------|------|------|--------|
| Human | **Ring-Walker** | Biped + staff | Unshifted listener. Ash-glass staff. |
| Tank | **Stick Bear** | Stick-bundle bear | Replaces the old Cinderhide (boar) lock. See look below. |
| Healer | **Stick Deer** | Stick-armature deer | Replaces Stillmere Hart’s fleshy stag. See look below. |
| DPS | **Stick Lion** | Stick-armature lion | Replaces the old Graven Asp (serpent) lock. See look below. |
| Travel | **Racerunner** | Bound-stick lizard | Replaces Waystone Hare. Move only. Combat or damage drops to human. |

Player-facing labels are these names, never “tank form” / “Bear Form” / “Cat Form” / “Travel Form”.

Preset keys: `druid`, `druid:stickbear`, `druid:stickdeer`, `druid:sticklion`, `druid:racerunner`. Form enum: `0` human, `1` stickbear, `2` stickdeer, `3` sticklion, `4` racerunner.

### Stick Bear look (tank)

Reference: [stick-bear.png](stick-bear.png) — a walking pile of bundled twigs in a bear silhouette. That is the lock, not a fleshy bear and not the ashbeam boar.

| Layer | Lock |
|--------|------|
| **Silhouette** | Large quadruped, hunched, no tusks. Head, snout, and ears read as bear. Body is a dense bundle of short sticks, not a smooth hide. Bigger than Stick Deer (`size` ~1.48). Readable at iso distance. |
| **Material** | Ashwood / kiln sticks, dust and chalk, muted garnet at the joints. Dead-city kindling, not green spring forest. |
| **Draw** | Own `Body` / creature path (bundle of sticks). Do **not** reuse `ashbeam_boar` or `Quadruped { tusks: true }`. |
| **Avoids** | Boar tusks, Cinderhide name, WoW “Bear Form”, TIM teal, Knight silver-crimson, living-fur brown teddy. |

### Stick Lion look (DPS)

Reference: [stick-lion.png](stick-lion.png) — a lean lion of long sticks, radiating mane, tufted tail. That is the lock, not a fleshy cat and not a serpent.

| Layer | Lock |
|--------|------|
| **Silhouette** | Proud quadruped, longer legs than Bear, small head, radiating-stick mane, long tail with a stick tuft. Reads as lion at iso distance. Mid size (`size` ~1.32) — between Stick Deer and Bear. |
| **Material** | Same ashwood / kiln sticks as Stick Bear, but a **sparse armature** (long limbs, open ribs), not the Bear’s dense bundle. Dust and chalk; muted garnet at the joints. |
| **Draw** | Own `Body` / creature path. Do **not** reuse `Body::Serpent`, `ashbeam_boar`, or the Stick Bear bundle mesh. |
| **Avoids** | Graven Asp name, snake body, WoW “Cat Form”, living-fur gold lion, TIM teal. |

### Stick Deer look (healer)

Reference: [stick-deer.png](stick-deer.png) — a slender deer of long sticks with branching antlers and an open rib cage. That is the lock.

A wildlife deer/stag is already in the world plan (Green Reach **Old Banding** / any `mob:stag`). Stick Deer is **not** that mob. Do not reuse its mesh, palette, or preset.

| Layer | Lock |
|--------|------|
| **Silhouette** | Long-legged, thin neck, small head, **branching antlers** (the read). Open triangular rib cage. No mane, no tufted lion tail. Smaller than Lion (`size` ~1.22). |
| **Material** | Same ashwood / kiln sticks. **Sparse armature** like Stick Lion (not the Bear’s dense bundle). Dust and chalk; muted garnet at the joints. |
| **Draw** | Own `Body` / creature path. Do **not** clone `mob:stag`, Old Banding, `ashbeam_boar`, Stick Bear, or Stick Lion. |
| **Avoids** | Stillmere Hart name as the player label, fleshy deer hide, living-fur brown, TIM teal, Cleric sky-blue. |

### Racerunner look (travel)

Reference: [racerunner.jpg](racerunner.jpg) — a long, low lizard of bound sticks: pointed snout, four thin legs, a tail longer than the body, ember spark at the tip. That is the lock.

| Layer | Lock |
|--------|------|
| **Silhouette** | Lowest and longest form. Horizontal body, no hop. Pointed head, no ears, no antlers, no mane. Tail is the read — longer than torso, spark at the end. Smaller than Stick Deer (`size` ~0.95 length-scale, very low). |
| **Material** | Bound kiln-sticks / withies wrapped in rings (not the Bear’s loose bundle, not Lion/Deer open ribs). Dust and chalk; a **small ember** at the tail tip only. |
| **Draw** | Own `Body` / creature path (lizard, not hop-quad). Do **not** reuse `dust_hare`, `Body::Serpent` / `cliff_adder`, Stick Bear, Stick Lion, or Stick Deer. |
| **Avoids** | Waystone Hare name, hop gait, bunny ears, WoW “Travel Form”, living lizard skin, TIM teal. |

### Grades (human) + tank retune

HP **C+**, MP **B**, STR **D**, DEX **C**, VIT **C**, AGI **C**, INT **C**, MND **B**.

Stick Bear HP: `min(floor(hp×1.28), knightHp−4)` → L1 **156** / L75 **~677** vs Knight 160 / ~752. Hate **70%** of Warhorn. Best self DT **0.70** (Sentinel is 0.50). No Interpose / Hall Aegis. No shield block. Autos are STR melee.

On shift: recompute max HP, **clamp current HP down, never heal up**. Dropping Stick Bear can clip HP. MP pool does not change.

### Shift rules

One form at a time. 0 MP. **Shared 20s family recast** on all five shift ids. Persist across zones.

**Drop** only on death, job change, or (Racerunner) damage / a combat ability. **Do not** drop on unequip main.

Talk, craft, gather, Job Master, and warp are allowed while shifted.

**Rest** works in every form, including Racerunner.

**Druid is not a support job.** Job Master must not offer it as a sub. `supportJobActive` / `job/sub` reject `druid`. A Druid main may still take one of the other seven as support. Forms require main job `druid` (already implied: you cannot be a Druid sub).

**2HR:** Ringwake. **Free:** Rest, Ringwake, Stick Bear (`dr_stickbear`).

### Stick Bear kit

| Lv | Id | Name | Recast | Effect |
|----|----|------|--------|--------|
| 1 | `dr_stickbear` | Stick Bear | 20s fam | Tank shift |
| 1 | `dr_stick_clamour` | Stick Clamour | 45s | Single-target hate **70%** of Warhorn |
| 5 | `dr_ash_brace` | Ash Brace | 90s / 20s | Self phys **0.78** |
| 10 | `dr_bracken_root` | Bracken Root | 40s / 6s | Rooted, −15% move, small hate pulse. Not Cover. |
| 15 | `dr_stick_maul` | Stick Maul | 30s | Cone physical pot **28** + hate |
| 20 | `dr_bundle_thicken` | Bundle Thicken | 3m / 15s | Self phys **0.70**. No magic DT. |

**L21–75:** `dr_stick_clamour_ii`, `dr_ash_brace_ii` (0.74), `dr_stick_maul_ii` (pot 48), `dr_kiln_shoulder` (0.68 self, still worse than Sentinel), `dr_ring_of_stakes` (8-yalm hate pulse, **no party DT**).

Do not ship `dr_cinderhide`, Tusk Clamour, Cinder Gore, Hide Thicken, or Ring of Tusks.

### Stick Lion kit (DPS)

HP `floor(hp×0.90)`. STR/DEX as **B** from seeds 8/9 — under Fighter STR A and Rogue DEX A. Fang/claw pot **~70%** of Ember Lance 55. Physical + bleed only. Autos: DEX claw, crit below Rogue. No elemental tiers, no Arcane Flood, no en-spell.

| Lv | Id | Name | Recast | Effect |
|----|----|------|--------|--------|
| 18 | `dr_sticklion` | Stick Lion | 20s fam | DPS shift |
| 18 | `dr_stick_rake` | Stick Rake | 6s | Physical pot **38** + dust-bleed 4/tick (Ember Lance is **55** magic) |
| 20 | `dr_mane_dust` | Mane Dust | 20s / 8s | Next 3 autos +15% rake; light ground DoT |

**L21–75:** `dr_stick_rake_ii` (pot 72 vs Lance II 120), `dr_stick_pounce` (15s, stun 1.5s, pot 40), `dr_mane_dust_ii`, `dr_stick_rake_iii` (pot 140 vs Lance III 210), `dr_long_pounce` (45s, pot 160, gap-close 6 yalms), `dr_mane_fury` (3m / 12s, +20% rake, still under Focal Neve / Killing Storm).

Do not ship `dr_graven_asp`, Glass Fang, Shed Dust, Coil Snap, Rook Strike, or Graven Coil.

### Stick Deer kit (healer)

Human HP (no secret tank). MND stays **B** (12 / ~43) vs Cleric **A**. Heals **≤70%** of the matching Ashmend. **No Raise, no -na, no Curaga.** Autos: weak hoof (caster deer).

| Lv | Id | Name | Recast | Effect |
|----|----|------|--------|--------|
| 8 | `dr_stickdeer` | Stick Deer | 20s fam | Healer shift |
| 8 | `dr_still_water` | Still Water | 5s | Ally heal **40** (~69% of Ashmend 58) |
| 10 | `dr_antler_hum` | Antler Hum | 12s / 12s | Ally HoT ~8 × 6 ticks (**~48**) |
| 15 | `dr_mere_veil` | Mere Veil | 40s / 20s | Ally absorb **25** HP |
| 18 | `dr_pair_mend` | Pair Mend | 10s | Two lowest allies **36** each. Not Curaga. |
| 20 | `dr_still_water_ii` | Still Water II | 6s | Ally heal **90** (~67% of Ashmend II 135) |

**L21–75:** `dr_antler_hum_ii`, `dr_still_water_iii` (180 vs Ashmend III 270), `dr_pair_mend_ii`, `dr_mere_veil_ii` (absorb 60), `dr_still_water_iv` (340 vs Ashmend IV 500), `dr_heptad_hum` (75, 8s, 10-yalm HoT totaling ~55% of a Curaga).

Do not ship `dr_stillmere_hart` as the player-facing shift.

### Racerunner kit (travel)

HP `floor(hp×0.75)`. Combat stats ignored. Move **×1.40** (`PLAYER_SPEED` 6 → 8.4). Flux is ×1.12; Tempo II is +24% move. **No haste** (TIM owns that). No auto-attack. No hostile abilities. **Any damage taken or any combat ability forces Ring-Walk** (free, no family recast). Ringwake hidden/blocked. **Rest is allowed.** Hotbar: shifts + Ring-Walk + dashes + Rest.

| Lv | Id | Name | Recast | Effect |
|----|----|------|--------|--------|
| 12 | `dr_racerunner` | Racerunner | 20s fam | Travel shift |
| 12 | *(passive)* | Race Stride | — | Move ×1.40 while formed |
| 15 | `dr_tail_dash` | Tail Dash | 45s | Dash 8 yalms. Not a strike. |
| 20 | `dr_ember_tail` | Ember Tail | 60s / 8s | Move ×1.50 for the window. Still no combat. |

**L21–75:** `dr_tail_dash_ii` (40, 12 yalms), `dr_long_run` (55, 3m / 20s, ×1.55), `dr_ember_run` (75, 10m / 12s, ×1.65, **breaks on any enemy targeting you**).

Do not ship `dr_waystone_hare`, Circle Hop, Dust Listen, Ore Road, or Lantern Run.

### Other form kits (unchanged roles)

Ring-Walker: Dustmend / Sour Hum / Chalk Ward (weak singer).

**Weapons:** staff + club. Animals hide the staff; equipped stats still apply.

**FX:** Dust, ash-gold, incomplete heptad — not TIM teal orbs. Stick Bear: rattling sticks. Stick Lion: rake of splinters. Stick Deer: chalk ripple / antler hum. Racerunner: dust puff + tail ember, not haste orbs.

**Skill tree (locked):** Druid gets its **own 85-node district** (`druid_0`…`druid_84`), same shape as the others (1 hub + 10 core + 6×11 pods + 8 travel). Place that island in the **middle** of the web (origin), not on the outer job ring.

Do **not** recompute `perJob = floor(COUNT / JOB_IDS.length)`. The seven live districts stay 85 nodes at `R = 1720`; their `${job}_0`…`${job}_84` ids must not move or shrink. Raise `SKILL_TREE_NODE_COUNT` to **685** (600 + 85) as an add-on, not a reslice.

Connect Henge to every class through **edge / travel nodes**: spokes from the center island’s rim to each outer district’s inward-facing travel tips (plus existing neighbor corridors). A path from any job can reach Druid without crossing a hub. `JOB_LABEL.druid = "Henge"`. `JOB_FOCUS.druid = ["mnd", "vit", "agi"]`.

---

## FX motif quick map

| Job | Seed | Motifs |
|-----|------|--------|
| Knight | `…-knight` | Silver flash, crimson shield, pale-gold divine |
| Rogue | `…-rogue` | Violet smoke, cut lines |
| Cleric | `…-cleric` | White, sky blue, soft gold, bell/sun |
| Sorcerer | `…-sorcerer` | Violet/blue, per-element nuke colors |
| Fighter | `…-fighter` | Iron sparks, blood-red rage |
| Battle Mage | `…-battlemage` | Teal-bronze, blade runes |
| Time Mage | `…-timemage` | Dust gold, ash, deep teal, clock-bronze, orbital rings |
| Druid | `…-druid` | Dust, ash-gold, incomplete heptad; Bear bundle; Lion mane; Deer antlers; Racerunner tail-ember |

When implementing VFX for a JA/spell, invent layers that match **that** row — never default to TIM orb belts or Flux fringe.

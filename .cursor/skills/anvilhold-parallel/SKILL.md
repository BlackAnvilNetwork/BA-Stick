---
name: anvilhold-parallel
description: >-
  Parallel Anvilhold / Ashen Bastion castle passes with disjoint agent roles,
  locked distant shot, and integrator merge. Use when scaling SDF castle work
  across multiple agents, launching walls/houses/palette specialists, or
  merging anvilhold worktree/cloud slices.
---

# Anvilhold parallel agents

Full playbook: [`docs/maps/anvilhold-castle/PARALLEL.md`](../../../docs/maps/anvilhold-castle/PARALLEL.md).  
Shot lock: [`docs/maps/anvilhold-castle/SHOT.md`](../../../docs/maps/anvilhold-castle/SHOT.md).  
Rule: [`.cursor/rules/anvilhold-distant-shot.mdc`](../../rules/anvilhold-distant-shot.mdc).

## When launching specialists

1. Base them on a **pushed** branch that already has pitch **7.92** and BAM wiring.
2. Give each agent **one role** from PARALLEL.md (Walls / Houses / Palette).
3. Paste the frozen kit table + owned file list + “one lever then shot then stop”.
4. Require `passes/<UTC>-distant.png` + `passes/<UTC>-<role>.md` + artifacts copy.
5. Prefer **cloud / worktree** isolation — do not share one checkout for BAM copy.

## Integrator (this chat)

Merge one specialist at a time → rebuild `bastion` BAM → locked distant shot → next.

## Do not

- Change pitch / `AB_KIT_PITCH` / courtyard pads without integrator.
- Invent a new camera for progress shots.
- Edit outside the role’s owned files.

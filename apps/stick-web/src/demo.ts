/** Offline demo scene: stand-ins for server `UnitSnapshot`s until M1 wires the socket. */
export type DemoUnit = { id: string; x: number; z: number; facing: number; anim: string; preset: string };

export function demoUnits(t: number): DemoUnit[] {
  const a = t * 0.6;
  const walker: DemoUnit = {
    id: "player:knight",
    x: Math.cos(a) * 2.2,
    z: Math.sin(a) * 2.2,
    facing: Math.atan2(-Math.sin(a), Math.cos(a)), // tangent of the circle (yaw: 0 = +z)
    anim: "walk",
    preset: "knight",
  };
  return [
    walker,
    { id: "player:mage", x: -3.2, z: 1.4, facing: 1.2, anim: "idle", preset: "time_mage/female" },
    { id: "player:rogue", x: 2.8, z: -2.6, facing: -0.8, anim: Math.floor(t / 0.9) % 2 ? "melee" : "idle", preset: "rogue" },
    { id: "npc:vendor", x: -1.0, z: -3.6, facing: 0.4, anim: "idle", preset: "npc:vendor/pepeka" },
    { id: "mob:guard", x: 3.6, z: 2.4, facing: 3.6, anim: "idle", preset: "mob:petrified_guard" },
  ];
}

const ROSTER = [
  "mob:dust_hare", "mob:pale_slime", "mob:cliff_adder", "mob:ashbeam_boar", "mob:hollow_scavenger",
  "mob:ruin_dweller", "mob:seam_golem", "mob:shard_wight", "mob:guard",
  "npc:job_master", "npc:spell_trainer", "npc:guide", "npc:quest_giver", "npc:crafter", "npc:vendor",
];

/** `?demo&roster`: every mob archetype and NPC role, walking in place along +x. */
export function rosterUnits(t: number): DemoUnit[] {
  return ROSTER.map((preset, i) => {
    const col = i % 5;
    const row = Math.floor(i / 5);
    const walk = Math.floor(t / 2.5) % 2 === 0;
    const dx = walk ? ((t * 1.2) % 1.2) - 0.6 : 0;
    return { id: preset, x: (col - 2) * 2.4 + row * 1.2 + dx, z: (row - 1) * 2.4 - (col - 2) * 1.2, facing: Math.PI / 2 + (row % 2 ? 0.6 : -0.3), anim: walk ? "walk" : "idle", preset };
  });
}

const CROWD_PRESETS = ["knight", "rogue", "time_mage/female", "mob:petrified_guard"];

/** `n` units on a ring of lanes walking in circles, for the 200-unit perf target. */
export function crowdUnits(n: number) {
  const seeds = Array.from({ length: n }, (_, i) => ({ r: 3 + (i % 10) * 1.3, a0: (i * 2.399) % (Math.PI * 2), w: 0.25 + (i % 7) * 0.05 }));
  return (t: number) =>
    seeds.map((s, i) => {
      const a = s.a0 + t * s.w;
      return { id: `crowd:${i}`, x: Math.cos(a) * s.r, z: Math.sin(a) * s.r, facing: a + Math.PI / 2, anim: "walk", preset: CROWD_PRESETS[i % CROWD_PRESETS.length]! };
    });
}

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

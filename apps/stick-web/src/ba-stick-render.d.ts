// Ambient types for the wasm-bindgen package (generated into engine/ba-stick-render/pkg,
// which is gitignored). Kept by hand so `tsc` works without building the wasm first.
declare module "ba-stick-render" {
  export default function init(input?: unknown): Promise<unknown>;
  export class StickRenderer {
    constructor(canvas: HTMLCanvasElement, width: number, height: number);
    loadZone(bytes: Uint8Array): void;
    placeZone(bytes: Uint8Array, ox: number, oz: number): void;
    placeProps(bytes: Uint8Array, ox: number, oz: number): number;
    setMapOrigin(ox: number, oz: number): void;
    clearZone(): void;
    setMapTitle(t: string): void;
    addMapRoad(name: string, pts: Float32Array): void;
    addMapLabel(text: string, x: number, z: number, kind: number): void;
    clearMapData(): void;
    setMinimap(on: boolean): void;
    setMinimapFull(on: boolean): void;
    minimapFull(): boolean;
    minimapButton(sx: number, sy: number): boolean;
    minimapPanel(sx: number, sy: number): boolean;
    minimapBakes(): number;
    minimapLabels(): string;
    loadProps(bytes: Uint8Array): number;
    addFloater(id: string, kind: number, value: number): void;
    isWading(id: string): boolean;
    setAtmosphere(on: boolean): void;
    /** 0 clear, 1 rain, 2 fog, 3 snow; snowCover 0..1. */
    setWeather(kind: number, snowCover: number): void;
    cycleHairStyle(delta?: number): void;
    cycleHairColor(delta?: number): void;
    cycleBodyColor(delta?: number): void;
    setCamMode(mode: string): void;
    camMode(): string;
    setLook(yaw: number, pitch: number): void;
    addLook(dx: number, dy: number): void;
    firstPerson(): boolean;
    /** Legacy: true = third person, false = isometric. */
    setView3d(on: boolean): void;
    setKeylight(on: boolean): void;
    setBackdrop(on: boolean): void;
    setBootMenu(on: boolean): void;
    spawnVfx(prim: number, from: string, to: string, color: number, count: number, radius: number, flags: number): boolean;
    vfxCount(): number;
    setGear(id: string, family: number, wmat: number, wseed: number, body: number, bseed: number, head: number, hseed: number, legs: number, lseed: number): boolean;
    zoneHeight(x: number, z: number): number;
    setCamera(x: number, z: number): void;
    follow(id?: string): void;
    upsertUnit(id: string, x: number, y: number, z: number, facing: number, anim: string, preset: string): void;
    removeUnit(id: string): boolean;
    setFx(
      id: string,
      hp: number,
      cast: number,
      aoe: number,
      flags: number,
      fade: number,
      levelUp: number,
      weaponEdge: number,
    ): boolean;
    setBuffs(id: string, mask: number, td: number, burst: number): boolean;
    anchor(id: string): Float32Array;
    worldToScreen(x: number, y: number, z: number): Float32Array;
    unitCount(): number;
    pickWorld(sx: number, sy: number): Float32Array;
    /** Ground `[x, z]` under a pixel, or empty when a 3D pick misses (sky / past far). Iso always hits. */
    pickGround(sx: number, sy: number): Float32Array;
    /** Client WASD heading (radians) for third/first person; `undefined` clears it. */
    setHeading(heading?: number): void;
    /** Client dash prediction for the own unit; a running one only moves its landing. */
    predictDash(id: string, x: number, z: number, secs: number): void;
    cancelDash(id: string): void;
    camYaw(): number;
    pickUnit(sx: number, sy: number, skip?: string): string | undefined;
    tick(dt: number): void;
    draw(): void;
    free(): void;
  }
}

// Ambient types for the wasm-bindgen package (generated into engine/ba-stick-render/pkg,
// which is gitignored). Kept by hand so `tsc` works without building the wasm first.
declare module "ba-stick-render" {
  export default function init(input?: unknown): Promise<unknown>;
  export class StickRenderer {
    constructor(canvas: HTMLCanvasElement, width: number, height: number);
    loadZone(bytes: Uint8Array): void;
    clearZone(): void;
    setMapTitle(t: string): void;
    addMapRoad(name: string, pts: Float32Array): void;
    addMapLabel(text: string, x: number, z: number, kind: number): void;
    clearMapData(): void;
    setMinimap(on: boolean): void;
    minimapBakes(): number;
    minimapLabels(): string;
    loadProps(bytes: Uint8Array): number;
    addFloater(id: string, kind: number, value: number): void;
    isWading(id: string): boolean;
    setAtmosphere(on: boolean): void;
    setView3d(on: boolean): void;
    setKeylight(on: boolean): void;
    setBackdrop(on: boolean): void;
    spawnVfx(prim: number, from: string, to: string, color: number, count: number, radius: number, flags: number): boolean;
    vfxCount(): number;
    setGear(id: string, family: number, wmat: number, wseed: number, body: number, bseed: number, head: number, hseed: number, legs: number, lseed: number): boolean;
    zoneHeight(x: number, z: number): number;
    setCamera(x: number, z: number): void;
    follow(id?: string): void;
    upsertUnit(id: string, x: number, y: number, z: number, facing: number, anim: string, preset: string): void;
    removeUnit(id: string): boolean;
    setFx(id: string, hp: number, cast: number, aoe: number, flags: number, fade: number, levelUp: number): boolean;
    setBuffs(id: string, mask: number, td: number, burst: number): boolean;
    anchor(id: string): Float32Array;
    worldToScreen(x: number, y: number, z: number): Float32Array;
    unitCount(): number;
    pickWorld(sx: number, sy: number): Float32Array;
    pickUnit(sx: number, sy: number, skip?: string): string | undefined;
    tick(dt: number): void;
    draw(): void;
    free(): void;
  }
}

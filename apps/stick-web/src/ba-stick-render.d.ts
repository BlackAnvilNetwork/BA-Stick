// Ambient types for the wasm-bindgen package (generated into engine/ba-stick-render/pkg,
// which is gitignored). Kept by hand so `tsc` works without building the wasm first.
declare module "ba-stick-render" {
  export default function init(input?: unknown): Promise<unknown>;
  export class StickRenderer {
    constructor(canvas: HTMLCanvasElement, width: number, height: number);
    loadZone(bytes: Uint8Array): void;
    clearZone(): void;
    zoneHeight(x: number, z: number): number;
    setCamera(x: number, z: number): void;
    follow(id?: string): void;
    upsertUnit(id: string, x: number, y: number, z: number, facing: number, anim: string, preset: string): void;
    removeUnit(id: string): boolean;
    unitCount(): number;
    pickWorld(sx: number, sy: number): Float32Array;
    pickUnit(sx: number, sy: number): string | undefined;
    tick(dt: number): void;
    draw(): void;
    free(): void;
  }
}

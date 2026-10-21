import init, { StickRenderer } from "ba-stick-render";

export const FB_W = 640;
export const FB_H = 360;

let ready: Promise<unknown> | null = null;
/** Load the wasm module once. */
export function loadRenderer(): Promise<unknown> {
  ready ??= init();
  return ready;
}

export async function createRenderer(canvas: HTMLCanvasElement): Promise<StickRenderer> {
  await loadRenderer();
  return new StickRenderer(canvas, FB_W, FB_H);
}

/** Client pixel → framebuffer pixel for a `object-fit: contain` canvas. */
export function toFramebuffer(canvas: HTMLCanvasElement, clientX: number, clientY: number): [number, number] {
  const r = canvas.getBoundingClientRect();
  const scale = Math.min(r.width / FB_W, r.height / FB_H);
  const sx = (clientX - r.left - (r.width - FB_W * scale) / 2) / scale;
  const sy = (clientY - r.top - (r.height - FB_H * scale) / 2) / scale;
  return [sx, sy];
}

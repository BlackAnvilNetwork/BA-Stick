export const FB_W = 640;
export const FB_H = 360;

/** Pixels per framebuffer pixel for object-fit contain (letterbox) or cover (crop). */
export function fitScale(w: number, h: number, cover = false): number {
  return (cover ? Math.max : Math.min)(w / FB_W, h / FB_H);
}

export function fbFromClient(
  r: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number,
  cover = false,
): [number, number] {
  const scale = fitScale(r.width, r.height, cover);
  return [(clientX - r.left - (r.width - FB_W * scale) / 2) / scale, (clientY - r.top - (r.height - FB_H * scale) / 2) / scale];
}

export function fbToClient(w: number, h: number, fx: number, fy: number, cover = false): [number, number] {
  const scale = fitScale(w, h, cover);
  return [(w - FB_W * scale) / 2 + fx * scale, (h - FB_H * scale) / 2 + fy * scale];
}

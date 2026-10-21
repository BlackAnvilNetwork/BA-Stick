import * as THREE from "three";
import { isMagentaKey } from "@bellgrave/ui/chroma-icons";

export { isMagentaKey };

const chromaTexCache = new Map<string, THREE.Texture>();

function configureSpriteTex(out: THREE.Texture): THREE.Texture {
  out.needsUpdate = true;
  out.colorSpace = THREE.SRGBColorSpace;
  out.magFilter = THREE.LinearFilter;
  out.minFilter = THREE.LinearFilter;
  out.generateMipmaps = false;
  out.wrapS = out.wrapT = THREE.ClampToEdgeWrapping;
  return out;
}

/**
 * Knock out magenta / hot-pink on world sprites.
 * Results are cached by image src. Pre-baked sprites (transparent corners + little
 * leftover key) skip the full pixel walk.
 */
export function applyMagentaChroma(tex: THREE.Texture): THREE.Texture {
  const img = tex.image as HTMLImageElement | HTMLCanvasElement | ImageBitmap | undefined;
  if (!img || !("width" in img) || !img.width) {
    return configureSpriteTex(tex.clone());
  }

  const src =
    typeof (img as HTMLImageElement).src === "string" && (img as HTMLImageElement).src
      ? (img as HTMLImageElement).src
      : "";
  if (src) {
    const hit = chromaTexCache.get(src);
    if (hit) return hit;
  }

  const w = img.width;
  const h = img.height;

  // Fast path: pre-baked sprites already have transparent corners — skip CPU scan.
  const probe = document.createElement("canvas");
  probe.width = 1;
  probe.height = 1;
  const pctx = probe.getContext("2d", { willReadFrequently: true })!;
  pctx.drawImage(img as CanvasImageSource, 0, 0, 1, 1, 0, 0, 1, 1);
  const c0 = pctx.getImageData(0, 0, 1, 1).data;
  pctx.clearRect(0, 0, 1, 1);
  pctx.drawImage(img as CanvasImageSource, w - 1, 0, 1, 1, 0, 0, 1, 1);
  const c1 = pctx.getImageData(0, 0, 1, 1).data;
  if (c0[3]! < 8 && c1[3]! < 8) {
    const out = configureSpriteTex(tex.clone());
    if (src) chromaTexCache.set(src, out);
    return out;
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img as CanvasImageSource, 0, 0);
  const imageData = ctx.getImageData(0, 0, w, h);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3]! === 0) continue;
    if (isMagentaKey(d[i]!, d[i + 1]!, d[i + 2]!)) d[i + 3] = 0;
  }
  ctx.putImageData(imageData, 0, 0);
  const out = tex.clone();
  out.image = canvas;
  configureSpriteTex(out);
  if (src) chromaTexCache.set(src, out);
  return out;
}

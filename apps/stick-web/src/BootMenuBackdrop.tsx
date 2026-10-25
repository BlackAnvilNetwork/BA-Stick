import { useEffect, useRef } from "react";
import { createBootRenderer } from "./renderer";
import type { StickRenderer } from "ba-stick-render";
import { FORGE_BACKDROP_SRC } from "./boot-menu-theme";
import {
  createPixelPassState,
  paintContentAwarePixels,
  rasterizeNative,
  type PhotoField,
  type PixelPassState,
} from "./boot-menu-photo-pixels";
import { registerBootMenuLoop } from "./boot-menu-runtime";

/** `static` = photo only; `live` = pixel pass + WASM; `off` = render nothing. */
export type BootMenuBackdropMode = "off" | "static" | "live";

type Props = { mode: BootMenuBackdropMode };

function BootMenuBackdropStatic() {
  return (
    <div className="boot-menu-backdrop" aria-hidden>
      <img className="boot-menu-photo" src={FORGE_BACKDROP_SRC} alt="" draggable={false} />
    </div>
  );
}

/**
 * Boot menu: low-res forge photo (native pixels) + content-aware drift + WASM VFX overlay.
 * Only `live` mode runs RAF/WASM — select/create use `static` so play stays smooth.
 */
export function BootMenuBackdrop({ mode }: Props) {
  const pixelRef = useRef<HTMLCanvasElement>(null);
  const wasmRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (mode !== "live") return;

    const pixelCanvas = pixelRef.current;
    const wasmCanvas = wasmRef.current;
    if (!pixelCanvas || !wasmCanvas) return;

    let alive = true;
    let raf = 0;
    let renderer: StickRenderer | null = null;
    let field: PhotoField | null = null;
    let pixelState: PixelPassState | null = null;
    let t = 0;

    const stop = () => {
      if (!alive) return;
      alive = false;
      cancelAnimationFrame(raf);
      raf = 0;
      renderer?.setBootMenu(false);
      renderer?.free();
      renderer = null;
    };

    const unregister = registerBootMenuLoop(stop);

    void (async () => {
      const img = new Image();
      img.decoding = "async";
      img.src = FORGE_BACKDROP_SRC;
      await img.decode();
      if (!alive) return;

      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      pixelCanvas.width = iw;
      pixelCanvas.height = ih;
      wasmCanvas.width = iw;
      wasmCanvas.height = ih;

      field = rasterizeNative(img);
      pixelState = createPixelPassState();

      const rr = await createBootRenderer(wasmCanvas, iw, ih);
      if (!alive) {
        rr.free();
        return;
      }
      renderer = rr;
      rr.setMinimap(false);
      rr.setMinimapFull(false);
      rr.setBootMenu(true);

      const pxCtx = pixelCanvas.getContext("2d", { alpha: true });
      if (!pxCtx) {
        stop();
        return;
      }
      pxCtx.imageSmoothingEnabled = false;

      let last = performance.now();
      const frame = (now: number) => {
        if (!alive || !renderer) return;
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        t += dt;
        if (field && pixelState) paintContentAwarePixels(pxCtx, field, t, dt, pixelState);
        renderer.tick(dt);
        renderer.draw();
        if (alive) raf = requestAnimationFrame(frame);
      };
      if (alive) raf = requestAnimationFrame(frame);
    })();

    return () => {
      unregister();
      stop();
    };
  }, [mode]);

  if (mode === "off") return null;
  if (mode === "static") return <BootMenuBackdropStatic />;

  return (
    <div className="boot-menu-backdrop" aria-hidden>
      <img className="boot-menu-photo" src={FORGE_BACKDROP_SRC} alt="" draggable={false} />
      <canvas ref={pixelRef} className="boot-menu-pixel-pass" />
      <canvas ref={wasmRef} className="boot-menu-vfx" />
    </div>
  );
}

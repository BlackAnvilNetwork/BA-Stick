import { useEffect, useRef } from "react";
import { getItem } from "@bellgrave/items";
import type { FigurePreviewProps } from "@bellgrave/ui/FigurePreview";
import { StickRenderer } from "ba-stick-render";
import { loadRenderer } from "./renderer";
import { gearArgs, previewPreset } from "./gear";

export const PREVIEW_W = 80;
export const PREVIEW_H = 110;

/**
 * Live stick-figure preview (#37): its own small renderer, transparent
 * backdrop, the figure idling and slowly turning. Used on character
 * create/select and beside the paperdoll (with equipped gear via #14).
 */
export function StickPreview({ job, gender, equip, size = 140, className }: FigurePreviewProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const r = useRef<StickRenderer | null>(null);
  const want = useRef({ job, gender, equip });
  want.current = { job, gender, equip };

  useEffect(() => {
    let raf = 0;
    let alive = true;
    void loadRenderer().then(() => {
      if (!alive || !ref.current) return;
      const rr = new StickRenderer(ref.current, PREVIEW_W, PREVIEW_H);
      rr.setBackdrop(true);
      rr.setAtmosphere(false);
      rr.setCamera(0, 0);
      r.current = rr;
      let last = performance.now();
      let yaw = 0.6;
      let key = "";
      const frame = (now: number) => {
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        yaw += dt * 0.6;
        const w = want.current;
        const preset = previewPreset(w.job, w.gender);
        rr.upsertUnit("p", 0, 0, 0, yaw, "idle", preset);
        const g = gearArgs(w.equip ?? undefined, getItem);
        const k = preset + g.join(",");
        rr.tick(dt);
        if (k !== key && rr.setGear("p", ...g)) key = k;
        rr.draw();
        if (alive) raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    });
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      r.current?.free();
      r.current = null;
    };
  }, []);

  return (
    <canvas
      ref={ref}
      className={`stick-preview ${className ?? ""}`.trim()}
      data-job={job}
      data-gender={gender ?? "male"}
      style={{ height: size, width: (size * PREVIEW_W) / PREVIEW_H }}
    />
  );
}

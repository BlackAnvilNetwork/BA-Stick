import { useEffect, useRef } from "react";
import { send } from "@bellgrave/client-core/net";
import { useGame } from "@bellgrave/client-core/state";
import { clampPaleHollow } from "@bellgrave/config";
import {
  clearKeyboardMove,
  setKeyboardMoveKey,
  type MoveKeys,
} from "@bellgrave/ui/moveInput";
import { FB_H, FB_W, bakedZoneFor, createRenderer, fetchZone, toFramebuffer } from "./renderer";
import { syncUnits } from "./units";
import { getMoveKeys, wasdTarget } from "./input";

/** Seconds between WASD move sends (legacy client: 0.05). */
const WASD_INTERVAL = 0.05;

/**
 * The world canvas: baked zone (#7), every snapshot unit as a stick figure
 * with interpolation and a camera on the local player (#8), click/WASD
 * movement through the server (#9).
 */
export function StickWorld() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    let raf = 0;
    let alive = true;
    const cleanups: Array<() => void> = [];
    void createRenderer(canvas).then((r) => {
      if (!alive) return;
      let zoneLoaded: string | null = null;
      let lastSnap: unknown = null;
      let followed: string | undefined;
      const known = new Set<string>();
      let wasdAccum = 0;
      let last = performance.now();

      const myUnit = () => {
        const g = useGame.getState();
        return g.wallet ? g.snapshot?.units.find((u) => u.id === g.wallet) : undefined;
      };
      const pick = (sx: number, sy: number): [number, number] => {
        const p = r.pickWorld(sx, sy);
        return [p[0], p[1]];
      };

      const onPointer = (e: PointerEvent) => {
        if (e.button !== 0 && e.button !== 2) return;
        if (useGame.getState().phase !== "play" || !myUnit()) return;
        const [sx, sy] = toFramebuffer(canvas, e.clientX, e.clientY);
        if (sx < 0 || sy < 0 || sx > FB_W || sy > FB_H) return;
        const [x, z] = pick(sx, sy);
        const c = clampPaleHollow(x, z);
        send({ type: "move", x: c.x, z: c.z });
      };
      const onContext = (e: MouseEvent) => e.preventDefault();
      const isMoveKey = (k: string): k is keyof MoveKeys => k === "w" || k === "a" || k === "s" || k === "d";
      const typing = (e: KeyboardEvent) => {
        const t = e.target as HTMLElement | null;
        return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      };
      const down = (e: KeyboardEvent) => {
        const k = e.key.toLowerCase();
        if (isMoveKey(k) && !typing(e)) {
          setKeyboardMoveKey(k, true);
          e.preventDefault();
        }
      };
      const up = (e: KeyboardEvent) => {
        const k = e.key.toLowerCase();
        if (isMoveKey(k)) setKeyboardMoveKey(k, false);
      };
      canvas.addEventListener("pointerdown", onPointer);
      canvas.addEventListener("contextmenu", onContext);
      window.addEventListener("keydown", down);
      window.addEventListener("keyup", up);
      window.addEventListener("blur", clearKeyboardMove);
      cleanups.push(() => {
        canvas.removeEventListener("pointerdown", onPointer);
        canvas.removeEventListener("contextmenu", onContext);
        window.removeEventListener("keydown", down);
        window.removeEventListener("keyup", up);
        window.removeEventListener("blur", clearKeyboardMove);
        clearKeyboardMove();
      });

      const frame = (now: number) => {
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        const g = useGame.getState();
        const snap = g.snapshot;
        const want = bakedZoneFor(snap?.you.zoneId);
        if (want !== zoneLoaded) {
          zoneLoaded = want;
          if (!want) r.clearZone();
          else void fetchZone(want).then((b) => { if (alive && zoneLoaded === want) r.loadZone(b); });
        }
        if (snap && snap !== lastSnap) {
          lastSnap = snap;
          syncUnits(r, snap.units, known, Date.now());
        }
        const me = myUnit();
        if (me?.id !== followed) {
          followed = me?.id;
          r.follow(followed);
        }
        wasdAccum += dt;
        if (me && wasdAccum >= WASD_INTERVAL) {
          wasdAccum = 0;
          const t = wasdTarget(getMoveKeys(), me, pick, [FB_W / 2, FB_H / 2]);
          if (t) send({ type: "move", x: t.x, z: t.z });
        }
        r.tick(dt);
        r.draw();
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    });
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      for (const c of cleanups) c();
    };
  }, []);
  return <canvas ref={ref} className="stick-canvas" />;
}

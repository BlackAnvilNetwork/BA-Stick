import { useEffect, useRef } from "react";
import { useGame } from "@bellgrave/client-core/state";
import { createRenderer } from "./renderer";

/**
 * The world canvas. M1 #6: renders the zone around the local player.
 * The snapshot → unit bridge and input arrive with #8 / #9.
 */
export function StickWorld() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0;
    let alive = true;
    void createRenderer(ref.current!).then((r) => {
      if (!alive) return;
      let last = performance.now();
      const frame = (now: number) => {
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        const snap = useGame.getState().snapshot;
        const me = snap?.units.find((u) => u.id === snap.you.characterId || u.characterId === snap.you.characterId);
        if (me) r.setCamera(me.x, me.z);
        r.tick(dt);
        r.draw();
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    });
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, []);
  return <canvas ref={ref} className="stick-canvas" />;
}

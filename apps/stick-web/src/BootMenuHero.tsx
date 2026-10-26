import { useEffect, useRef } from "react";
import { useGame } from "@bellgrave/client-core/state";
import type { JobId } from "@bellgrave/combat";
import { createRenderer } from "./renderer";
import { previewPreset } from "./gear";
import type { StickRenderer } from "ba-stick-render";
import { registerBootMenuLoop } from "./boot-menu-runtime";

const HERO_ID = "menu_hero";
const START = { x: -8.5, y: 0.55, z: 3.85, facing: 0.45 };
const STAND = { x: -1.05, y: 0.55, z: 3.85, facing: 0.52 };

function selectedCharacter(state: ReturnType<typeof useGame.getState>) {
  const { characters, selectedCharId, characterPreview } = state;
  if (characters.length > 0) {
    return characters.find((c) => c.id === selectedCharId) ?? characters[0];
  }
  return characterPreview;
}

type Props = { active: boolean };

/** Walk-in hero — only on character select (not during world play). */
export function BootMenuHero({ active }: Props) {
  const connected = useGame((s) => s.connected);
  const phase = useGame((s) => s.phase);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastPresetRef = useRef<string | null>(null);

  const show = active && connected && phase === "select";

  useEffect(() => {
    if (!show) {
      lastPresetRef.current = null;
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    let alive = true;
    let raf = 0;
    let renderer: StickRenderer | null = null;

    const stop = () => {
      if (!alive) return;
      alive = false;
      cancelAnimationFrame(raf);
      raf = 0;
      renderer?.removeUnit(HERO_ID);
      renderer?.setBootMenu(false);
      renderer?.free();
      renderer = null;
    };

    const unregister = registerBootMenuLoop(stop);

    void (async () => {
      const rr = await createRenderer(canvas);
      if (!alive) {
        rr.free();
        return;
      }
      renderer = rr;
      rr.setMinimap(false);
      rr.setMinimapFull(false);
      rr.setBootMenu(true);
      rr.follow(HERO_ID);

      const ch = selectedCharacter(useGame.getState());
      const job = (ch?.job ?? "fighter") as JobId;
      const gender = ch && "gender" in ch ? ch.gender : undefined;
      const preset = previewPreset(job, gender);
      lastPresetRef.current = preset;

      rr.upsertUnit(HERO_ID, START.x, START.y, START.z, START.facing, "walk", preset);
      rr.upsertUnit(HERO_ID, STAND.x, STAND.y, STAND.z, STAND.facing, "walk", preset);

      let last = performance.now();
      const frame = (now: number) => {
        if (!alive || !renderer) return;
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;

        const cur = selectedCharacter(useGame.getState());
        if (cur) {
          const p = previewPreset(
            (cur.job ?? "fighter") as JobId,
            "gender" in cur ? cur.gender : undefined,
          );
          if (p !== lastPresetRef.current) {
            lastPresetRef.current = p;
            renderer.upsertUnit(HERO_ID, STAND.x, STAND.y, STAND.z, STAND.facing, "idle", p);
          }
        }

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
  }, [show]);

  if (!show) return null;

  return <canvas ref={canvasRef} className="boot-menu-hero" aria-hidden />;
}

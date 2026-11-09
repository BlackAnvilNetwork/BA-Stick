/**
 * Mobile / arcade overlay: ghost Move stick (bottom-left) + ability-icon cluster
 * (bottom-right). Hosted on `.hud-root` as an absolute overlay so it outlives
 * the desktop hotbar and does not steal document flow from the world.
 */
import { abilityRecastMs, type AbilityId } from "@bellgrave/combat";
import { DASH_COOLDOWN_MS } from "@bellgrave/config";
import { useCallback, useEffect, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { AbilityIcon } from "./AbilityIcon";
import { clearVirtualStick, markVirtualStickReleased, setVirtualStick, setVirtualStickCaptured } from "./moveInput";

export const ARCADE_FACE_COUNT = 8;
/** Visible ability orbs on the overlay (pager chip cycles the rest). */
export const ARCADE_VISIBLE_FACES = 6;

function CdVeil({ leftMs, totalMs }: { leftMs: number; totalMs: number }) {
  if (leftMs <= 0 || totalMs <= 0) return null;
  const cdPct = Math.min(1, leftMs / totalMs);
  const cdSec = Math.ceil(leftMs / 1000);
  return (
    <span className="skill-cd" style={{ ["--cd" as string]: String(cdPct) } as CSSProperties} aria-label={`${cdSec}s cooldown`}>
      <span className="skill-cd-veil" />
      <span className="skill-cd-num">{cdSec}</span>
    </span>
  );
}

function VirtualStick() {
  const rootRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const activePtr = useRef<number | null>(null);

  const apply = useCallback((clientX: number, clientY: number) => {
    const el = rootRef.current;
    const knob = knobRef.current;
    if (!el || !knob) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const max = Math.max(rect.width * 0.36, 1);
    let dx = clientX - cx;
    let dy = clientY - cy;
    const mag = Math.hypot(dx, dy);
    if (mag > max && mag > 0) {
      dx = (dx / mag) * max;
      dy = (dy / mag) * max;
    }
    const nx = dx / max;
    const ny = -dy / max;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    setVirtualStick(nx, ny);
  }, []);

  // Unmounting mid-drag (HUD phase change, layout swap) would leave the stick captured: the
  // character keeps walking and ground clicks stay blocked.
  useEffect(
    () => () => {
      setVirtualStickCaptured(false);
      clearVirtualStick();
      markVirtualStickReleased();
    },
    [],
  );

  const end = useCallback((ptrId: number) => {
    if (activePtr.current !== ptrId) return;
    activePtr.current = null;
    const knob = knobRef.current;
    if (knob) knob.style.transform = "translate(0px, 0px)";
    rootRef.current?.removeAttribute("data-arcade-held");
    setVirtualStickCaptured(false);
    clearVirtualStick();
    markVirtualStickReleased();
  }, []);

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    activePtr.current = e.pointerId;
    e.currentTarget.setAttribute("data-arcade-held", "1");
    setVirtualStickCaptured(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* some desktop browsers reject capture — drag still works via move/up */
    }
    apply(e.clientX, e.clientY);
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (activePtr.current !== e.pointerId) return;
    e.preventDefault();
    apply(e.clientX, e.clientY);
  };
  const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    end(e.pointerId);
  };

  return (
    <div className="arcade-stick arcade-stick-move" aria-label="Move" data-arcade-stick="move">
      <div
        ref={rootRef}
        className="arcade-stick-pad"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onLostPointerCapture={onUp}
      >
        <div className="arcade-stick-ring" />
        <div ref={knobRef} className="arcade-stick-knob" />
      </div>
    </div>
  );
}

function firePointer(e: ReactPointerEvent<HTMLButtonElement>, fn?: () => void) {
  if (e.button !== 0) return;
  e.preventDefault();
  fn?.();
}

export function MobileArcadeControls({
  potions,
  dashCdMs = 0,
  hotbarFaces = [],
  recasts = {},
  now = 0,
  form = 0,
  restUnlocked = false,
  page = 0,
  onCastSlot,
  onCastRest,
  onDash,
  onPotion,
  onPage,
}: {
  potions: number;
  dashCdMs?: number;
  hotbarFaces?: readonly (AbilityId | null)[];
  recasts?: Partial<Record<AbilityId, number>>;
  now?: number;
  form?: number;
  restUnlocked?: boolean;
  page?: number;
  onCastSlot: (index: number) => void;
  onCastRest: () => void;
  onDash?: () => void;
  onPotion: () => void;
  onPage?: () => void;
}) {
  const faces = Array.from({ length: ARCADE_VISIBLE_FACES }, (_, i) => hotbarFaces[i] ?? null);
  const restUntil = recasts.rest ?? 0;
  const restLeft = Math.max(0, restUntil - now);

  return (
    <div
      className="arcade-controls"
      aria-label="Mobile arcade controls"
      data-arcade-controls="1"
      data-arcade-overlay="1"
      data-testid="mobile-arcade-controls"
    >
      <VirtualStick />
      <div className="arcade-face-cluster" aria-label="Arcade hotkeys">
        <div className="arcade-face-utils">
          <button
            type="button"
            className="arcade-face-btn arcade-face-util"
            aria-label={dashCdMs > 0 ? `Dash. ${Math.ceil(dashCdMs / 1000)}s cooldown` : "Dash"}
            disabled={dashCdMs > 0}
            data-arcade-dash="1"
            onPointerDown={(e) => firePointer(e, onDash)}
          >
            <span className="arcade-dash-glyph" aria-hidden>
              ››
            </span>
            <CdVeil leftMs={dashCdMs} totalMs={DASH_COOLDOWN_MS} />
          </button>
          <button
            type="button"
            className="arcade-face-btn arcade-face-util"
            aria-label={`Potion ×${potions}`}
            data-arcade-potion="1"
            onPointerDown={(e) => firePointer(e, onPotion)}
          >
            <AbilityIcon id="potion" form={form} />
            <span className="arcade-face-sub">×{potions}</span>
          </button>
          <button
            type="button"
            className="arcade-face-btn arcade-face-util"
            aria-label={restUnlocked ? "Rest" : "Rest locked"}
            data-arcade-rest="1"
            onPointerDown={(e) => firePointer(e, restUnlocked ? onCastRest : undefined)}
          >
            {restUnlocked ? <AbilityIcon id="rest" form={form} /> : <span className="arcade-face-empty-mark" aria-hidden />}
            {restUnlocked ? <CdVeil leftMs={restLeft} totalMs={abilityRecastMs("rest")} /> : null}
          </button>
        </div>
        <div className="arcade-face-grid">
          {faces.map((id, i) => (
            <ArcadeFace
              key={i}
              index={i}
              id={id}
              form={form}
              now={now}
              recasts={recasts}
              onCastSlot={onCastSlot}
            />
          ))}
        </div>
        {onPage ? (
          <button
            type="button"
            className="arcade-pager-chip"
            data-arcade-pager="1"
            aria-label={`Hotbar row ${page + 1} of 3`}
            onPointerDown={(e) => firePointer(e, onPage)}
          >
            <span className="arcade-pager-mark" aria-hidden>
              ⋯
            </span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ArcadeFace({
  index,
  id,
  form,
  now,
  recasts,
  onCastSlot,
}: {
  index: number;
  id: AbilityId | null;
  form: number;
  now: number;
  recasts: Partial<Record<AbilityId, number>>;
  onCastSlot: (index: number) => void;
}) {
  if (!id) {
    return (
      <button
        type="button"
        className="arcade-face-btn arcade-face-empty"
        aria-label={`Hotkey ${index + 1}. Empty`}
        data-arcade-slot={index}
        disabled
      />
    );
  }
  const until = recasts[id] ?? 0;
  const leftMs = Math.max(0, until - now);
  return (
    <button
      type="button"
      className="arcade-face-btn"
      aria-label={`Hotkey ${index + 1}`}
      data-arcade-slot={index}
      onPointerDown={(e) => firePointer(e, () => onCastSlot(index))}
    >
      <span className="arcade-face-key">{index + 1}</span>
      <AbilityIcon id={id} form={form} />
      <CdVeil leftMs={leftMs} totalMs={abilityRecastMs(id)} />
    </button>
  );
}

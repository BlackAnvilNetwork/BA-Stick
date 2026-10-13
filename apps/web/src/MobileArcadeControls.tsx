/**
 * Mobile / arcade overlay: left move stick, right skill stick (8-way hotbar),
 * and face buttons clustered between them.
 */
import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { clearVirtualStick, setVirtualStick } from "./moveInput";

type StickSide = "move" | "action";

const ACTION_SLOT_BY_OCTANT = [0, 1, 2, 3, 4, 5, 6, 7] as const;

function octantFromStick(nx: number, ny: number): number | null {
  const mag = Math.hypot(nx, ny);
  if (mag < 0.45) return null;
  const angle = Math.atan2(nx, ny); // 0 = up, + = right
  const oct = Math.round((angle / (Math.PI * 2)) * 8);
  return ((oct % 8) + 8) % 8;
}

function VirtualStick({
  side,
  label,
  onCommitAction,
}: {
  side: StickSide;
  label: string;
  onCommitAction?: (octant: number) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const activePtr = useRef<number | null>(null);
  const last = useRef({ nx: 0, ny: 0 });

  const apply = useCallback(
    (clientX: number, clientY: number) => {
      const el = rootRef.current;
      const knob = knobRef.current;
      if (!el || !knob) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const max = rect.width * 0.36;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const mag = Math.hypot(dx, dy);
      if (mag > max && mag > 0) {
        dx = (dx / mag) * max;
        dy = (dy / mag) * max;
      }
      const nx = dx / max;
      const ny = -dy / max;
      last.current = { nx, ny };
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      if (side === "move") setVirtualStick(nx, ny);
    },
    [side],
  );

  const end = useCallback(
    (ptrId: number) => {
      if (activePtr.current !== ptrId) return;
      activePtr.current = null;
      const knob = knobRef.current;
      if (knob) knob.style.transform = "translate(0px, 0px)";
      if (side === "move") {
        clearVirtualStick();
      } else if (onCommitAction) {
        const oct = octantFromStick(last.current.nx, last.current.ny);
        if (oct != null) onCommitAction(oct);
      }
      last.current = { nx: 0, ny: 0 };
    },
    [onCommitAction, side],
  );

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    activePtr.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
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
    <div className={`arcade-stick arcade-stick-${side}`} aria-label={label}>
      <div
        ref={rootRef}
        className="arcade-stick-pad"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <div className="arcade-stick-ring" />
        <div ref={knobRef} className="arcade-stick-knob" />
      </div>
      <div className="arcade-stick-label">{label}</div>
    </div>
  );
}

export function MobileArcadeControls({
  potions,
  onCastSlot,
  onCastRest,
  onPotion,
}: {
  potions: number;
  onCastSlot: (index: number) => void;
  onCastRest: () => void;
  onPotion: () => void;
}) {
  const castOctant = useCallback(
    (oct: number) => {
      const slot = ACTION_SLOT_BY_OCTANT[oct];
      if (slot == null) return;
      onCastSlot(slot);
    },
    [onCastSlot],
  );

  return (
    <div className="arcade-controls" aria-label="Mobile arcade controls">
      <VirtualStick side="move" label="Move" />
      <div className="arcade-face-cluster" aria-label="Arcade hotkeys">
        {Array.from({ length: 8 }, (_, i) => (
          <button
            key={i}
            type="button"
            className="arcade-face-btn"
            aria-label={`Hotkey ${i + 1}`}
            onPointerDown={(e) => {
              e.preventDefault();
              onCastSlot(i);
            }}
          >
            {String(i + 1)}
          </button>
        ))}
        <button
          type="button"
          className="arcade-face-btn arcade-face-util"
          aria-label="Rest"
          onPointerDown={(e) => {
            e.preventDefault();
            onCastRest();
          }}
        >
          R
        </button>
        <button
          type="button"
          className="arcade-face-btn arcade-face-util"
          aria-label={`Potion ×${potions}`}
          onPointerDown={(e) => {
            e.preventDefault();
            onPotion();
          }}
        >
          Q
          <span className="arcade-face-sub">×{potions}</span>
        </button>
      </div>
      <VirtualStick side="action" label="Skills" onCommitAction={castOctant} />
    </div>
  );
}

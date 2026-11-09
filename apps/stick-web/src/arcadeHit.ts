import { virtualStickHeld, virtualStickReleasedRecently } from "@bellgrave/ui/moveInput";

/** Extra CSS pixels around stick / cluster so a fat-finger miss is not a ground click. */
export const ARCADE_GROUND_SLOP = 56;

function inSlop(x: number, y: number, el: Element | null, slop: number): boolean {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return x >= r.left - slop && x <= r.right + slop && y >= r.top - slop && y <= r.bottom + slop;
}

/** Left-thumb park: a missed Move pad must not become an iso-south click-to-walk. */
function arcadeThumbPark(x: number, y: number): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  if (!document.querySelector("[data-arcade-overlay]")) return false;
  return x < window.innerWidth * 0.4 && y > window.innerHeight * 0.55;
}

/**
 * HUD-adjacent taps (Move pad, ability cluster, or a captured analog) must not
 * become canvas click-to-move. Center-screen glass stays world.
 */
export function arcadeBlocksGroundClick(x: number, y: number, slop = ARCADE_GROUND_SLOP): boolean {
  if (virtualStickHeld() || virtualStickReleasedRecently()) return true;
  if (typeof document === "undefined") return false;
  const stick = document.querySelector(".arcade-stick-move, .arcade-stick-pad");
  if (inSlop(x, y, stick, slop)) return true;
  const cluster = document.querySelector(".arcade-face-cluster");
  if (inSlop(x, y, cluster, slop)) return true;
  if (arcadeThumbPark(x, y)) return true;
  return false;
}

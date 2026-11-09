/** Viewport used to clamp the Commands dock (inner window or visualViewport). */
export type ChromeViewport = {
  width: number;
  height: number;
  offsetLeft?: number;
  offsetTop?: number;
};

export type ChromeDockStyle = {
  top: string;
  bottom: string;
  right: string;
  maxHeight: string;
};

/**
 * Place the Commands chrome relative to the hamburger.
 * Overlay Mobile pins the button at the top, so the dock drops below it.
 * Desktop hotbar keeps the pop-above placement.
 */
export function chromeDockStyle(
  btn: { top: number; right: number; bottom: number },
  vp: ChromeViewport,
  dockWidth = 196,
): ChromeDockStyle {
  const ox = vp.offsetLeft ?? 0;
  const oy = vp.offsetTop ?? 0;
  const vw = vp.width;
  const vh = vp.height;
  const rightEdge = ox + vw;
  const unclampedRight = rightEdge - btn.right;
  const maxRight = Math.max(8, vw - dockWidth - 8);
  const right = Math.max(8, Math.min(unclampedRight, maxRight));
  const topSpace = btn.top - oy;
  if (topSpace < vh / 3) {
    const top = Math.max(8, btn.bottom - oy + 8);
    const maxHeight = Math.max(80, vh - top - 8);
    return { top: `${top}px`, bottom: "auto", right: `${right}px`, maxHeight: `${maxHeight}px` };
  }
  const bottom = Math.max(8, oy + vh - btn.top + 10);
  const maxHeight = Math.max(80, btn.top - oy - 16);
  return { top: "auto", bottom: `${bottom}px`, right: `${right}px`, maxHeight: `${maxHeight}px` };
}

export function applyChromeDockStyle(chrome: HTMLElement, style: ChromeDockStyle): void {
  chrome.style.top = style.top;
  chrome.style.bottom = style.bottom;
  chrome.style.right = style.right;
  chrome.style.maxHeight = style.maxHeight;
}

export function readChromeViewport(
  win: Pick<Window, "innerWidth" | "innerHeight" | "visualViewport">,
): ChromeViewport {
  const vv = win.visualViewport;
  if (vv && vv.width > 0 && vv.height > 0) {
    return { width: vv.width, height: vv.height, offsetLeft: vv.offsetLeft, offsetTop: vv.offsetTop };
  }
  return { width: win.innerWidth, height: win.innerHeight };
}

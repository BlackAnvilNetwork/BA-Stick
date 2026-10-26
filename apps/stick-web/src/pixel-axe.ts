/** Gear ids with a pixel labrys head on the hand plane (+y along haft). */
export const PIXEL_AXE_GEAR_IDS = new Set([
  "ba_bronze_axe",
  "ba_decayed_axe",
  "ba_iron_great_axe",
  "ba_darksteel_great_axe",
  "ba_palace_great_axe",
]);

export type PixelAxeArt = "bronze" | "decayed" | "iron" | "darksteel" | "palace";

export function axeArtForGearId(id: string): PixelAxeArt | null {
  if (id === "ba_bronze_axe") return "bronze";
  if (id === "ba_decayed_axe") return "decayed";
  if (id === "ba_iron_great_axe") return "iron";
  if (id === "ba_darksteel_great_axe") return "darksteel";
  if (id === "ba_palace_great_axe") return "palace";
  return null;
}

export type PixelAxeColors = {
  haft: string;
  edge: string;
  head: string;
  socket: string;
  outline: string;
};

/** Wiki / viewer palette (bronze). */
export const BRONZE_AXE_COLORS: PixelAxeColors = {
  haft: "#d9a441",
  edge: "#d9a441",
  head: "#5f4b32",
  socket: "#d9a441",
  outline: "#3d3228",
};

/** All-black decayed labrys (in-world + viewer). */
export const DECAYED_AXE_COLORS: PixelAxeColors = {
  haft: "#18161f",
  edge: "#18161f",
  head: "#18161f",
  socket: "#18161f",
  outline: "#18161f",
};

const IRON_GREAT_AXE_COLORS: PixelAxeColors = {
  haft: "#9aa6b8",
  edge: "#18161f",
  head: "#9aa6b8",
  socket: "#9aa6b8",
  outline: "#18161f",
};

const DARKSTEEL_AXE_COLORS: PixelAxeColors = {
  haft: "#6a6470",
  edge: "#18161f",
  head: "#7d7486",
  socket: "#6a6470",
  outline: "#18161f",
};

const PALACE_GREAT_AXE_COLORS: PixelAxeColors = {
  haft: "#d9a441",
  edge: "#9aa6b8",
  head: "#e8eaef",
  socket: "#d9a441",
  outline: "#18161f",
};

/** Hand-frame pivot: top of haft where the head sits (+y toward the head). */
const HAFT_PIVOT_Y = 0.11;
const BRONZE_HAFT_LO = -0.22;
const HAFT_LEN = HAFT_PIVOT_Y - BRONZE_HAFT_LO;
/** Right-hand grip along the haft (0 = pommel, 1 = pivot). Sync `labrys_grip_y` in figure.rs. */
const HAFT_GRIP_FRAC = 0.38;
/** Left-hand grip on 2h great axes. Sync `labrys_offhand_grip_y`. */
const HAFT_OFFHAND_GRIP_FRAC = 0.72;

export function pixelAxeGripY(haftLenMul: number): number {
  const haftLo = HAFT_PIVOT_Y - HAFT_LEN * haftLenMul;
  return haftLo + (HAFT_PIVOT_Y - haftLo) * HAFT_GRIP_FRAC;
}

export function pixelAxeOffhandGripY(haftLenMul: number): number {
  const haftLo = HAFT_PIVOT_Y - HAFT_LEN * haftLenMul;
  return haftLo + (HAFT_PIVOT_Y - haftLo) * HAFT_OFFHAND_GRIP_FRAC;
}

/** Unscaled head geometry (sync with `draw_pixel_labrys_axe` in figure.rs). */
const BASE_SOCKET_X = 0.09;
const BASE_SOCKET_Y0 = 0.12;
const BASE_SOCKET_Y1 = 0.26;
const BASE_SOCKET_INNER_HALF = 0.062;
const BASE_WING_BOTTOM_Y = 0.028;
const BASE_WING_X_TOP = 0.345;
const BASE_WING_BOTTOM_REACH = 0.85;
const BASE_WING_X_BOT = 0.322;
const BASE_WING_OUT_X = 0.356;
const BASE_WING_OUT_FLARE = 0.022;
const BASE_WING_CHEV_X = 0.386;
const BASE_WING_OUT_Y1 = 0.212;
const BASE_CAP_Y1 = 0.286;
const BASE_CAP_HALF = 0.06;
const BASE_POMMEL_HALF = 0.024;
const BASE_POMMEL_RISE = 0.034;
/** Viewer haft line width (hand units); sync capsule `thick` in ba_*_axe.ron. */
const HAFT_STROKE_BASE = 2.35;

export type PixelAxeLayout = {
  haft: [number, number];
  /** Weapon-local y where the right hand sits; draw subtracts this from all y. */
  gripY: number;
  offhandGripY: number;
  twoHand: boolean;
  haftStroke: number;
  wingEdgeStroke: number;
  colors: PixelAxeColors;
  socketX: number;
  socketY0: number;
  socketY1: number;
  socketCy: number;
  socketInnerHalf: number;
  wingAttachX: number;
  wingY1: number;
  wingBottomY: number;
  wingXTop: number;
  wingXBot: number;
  wingOutXMid: number;
  wingOutXBot: number;
  wingChevX: number;
  wingChevY: number;
  wingOutY1: number;
  capY1: number;
  capHalf: number;
  pommelHalf: number;
  pommelRise: number;
};

function buildPixelAxeLayout(
  haftLenMul: number,
  headMul: number,
  colors: PixelAxeColors,
): PixelAxeLayout {
  const haftLo = HAFT_PIVOT_Y - HAFT_LEN * haftLenMul;
  const sx = (x: number) => x * headMul;
  const sy = (y: number) => HAFT_PIVOT_Y + (y - HAFT_PIVOT_Y) * headMul;
  const wingAttach = sx(BASE_SOCKET_X);
  const wingBottomX = (x: number) => wingAttach + (sx(x) - wingAttach) * BASE_WING_BOTTOM_REACH;
  const wingOutXMid = sx(BASE_WING_OUT_X) + sx(BASE_WING_OUT_FLARE);
  const wingOutXBot = wingBottomX(BASE_WING_OUT_X) + sx(BASE_WING_OUT_FLARE);
  const socketY0 = sy(BASE_SOCKET_Y0);
  const socketY1 = sy(BASE_SOCKET_Y1);
  const gripY = pixelAxeGripY(haftLenMul);
  return {
    haft: [haftLo, HAFT_PIVOT_Y],
    gripY,
    offhandGripY: pixelAxeOffhandGripY(haftLenMul),
    twoHand: haftLenMul > 1.5,
    haftStroke: HAFT_STROKE_BASE * Math.sqrt(haftLenMul),
    wingEdgeStroke: 0.68 * headMul,
    colors,
    socketX: wingAttach,
    socketY0,
    socketY1,
    socketCy: (socketY0 + socketY1) * 0.5,
    socketInnerHalf: sx(BASE_SOCKET_INNER_HALF),
    wingAttachX: wingAttach,
    wingY1: socketY1,
    wingBottomY: sy(BASE_WING_BOTTOM_Y),
    wingXTop: sx(BASE_WING_X_TOP),
    wingXBot: wingBottomX(BASE_WING_X_BOT),
    wingOutXMid,
    wingOutXBot,
    wingChevX: sx(BASE_WING_CHEV_X),
    wingChevY: sy((BASE_SOCKET_Y1 + BASE_WING_BOTTOM_Y) * 0.52),
    wingOutY1: sy(BASE_WING_OUT_Y1),
    capY1: sy(BASE_CAP_Y1),
    capHalf: sx(BASE_CAP_HALF),
    pommelHalf: sx(BASE_POMMEL_HALF),
    pommelRise: BASE_POMMEL_RISE * Math.sqrt(haftLenMul),
  };
}

const GREAT_AXE_SCALE = { haftLenMul: 3, headMul: 1.5 } as const;

const LAYOUTS: Record<string, PixelAxeLayout> = {
  ba_bronze_axe: buildPixelAxeLayout(1, 1, BRONZE_AXE_COLORS),
  ba_decayed_axe: buildPixelAxeLayout(1, 1, DECAYED_AXE_COLORS),
  ba_iron_great_axe: buildPixelAxeLayout(
    GREAT_AXE_SCALE.haftLenMul,
    GREAT_AXE_SCALE.headMul,
    IRON_GREAT_AXE_COLORS,
  ),
  ba_darksteel_great_axe: buildPixelAxeLayout(
    GREAT_AXE_SCALE.haftLenMul,
    GREAT_AXE_SCALE.headMul,
    DARKSTEEL_AXE_COLORS,
  ),
  ba_palace_great_axe: buildPixelAxeLayout(
    GREAT_AXE_SCALE.haftLenMul,
    GREAT_AXE_SCALE.headMul,
    PALACE_GREAT_AXE_COLORS,
  ),
};

export function pixelAxeLayoutForGearId(id: string): PixelAxeLayout | null {
  return LAYOUTS[id] ?? null;
}

/** @deprecated use layout.haft */
export const BRONZE_AXE_HAFT: [number, number] = LAYOUTS.ba_bronze_axe!.haft;
export const BRONZE_AXE_WING_BOTTOM_Y = BASE_WING_BOTTOM_Y;

export function pixelAxeBounds(id: string): Array<[number, number, number]> {
  const lay = pixelAxeLayoutForGearId(id);
  if (!lay) return [];
  const gy = lay.gripY;
  return [
    [0, lay.haft[0] - gy, 0],
    [0, lay.capY1 - gy, 0],
    [-lay.wingChevX, lay.wingBottomY - gy, 0],
    [lay.wingChevX, lay.wingY1 - gy, 0],
  ];
}

type At = (x: number, y: number) => { x: number; y: number };

function fillPoly(
  pen: CanvasRenderingContext2D,
  at: At,
  pts: Array<[number, number]>,
  color: string,
): void {
  pen.fillStyle = color;
  pen.beginPath();
  pts.forEach(([x, y], i) => {
    const s = at(x, y);
    if (i === 0) pen.moveTo(s.x, s.y);
    else pen.lineTo(s.x, s.y);
  });
  pen.closePath();
  pen.fill();
}

function strokeWingBladeEdge(
  pen: CanvasRenderingContext2D,
  at: At,
  fit: number,
  pts: Array<[number, number]>,
  color: string,
  width: number,
): void {
  const seg = (i: number, j: number) =>
    strokeLine(pen, at, fit, pts[i]![0], pts[i]![1], pts[j]![0], pts[j]![1], color, width);
  for (let i = 3; i < pts.length; i++) seg(i - 1, i);
  seg(pts.length - 1, 0);
}

function strokeLine(
  pen: CanvasRenderingContext2D,
  at: At,
  fit: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: string,
  width = 0.45,
): void {
  const a = at(x0, y0);
  const b = at(x1, y1);
  pen.strokeStyle = color;
  pen.lineWidth = Math.max(1.5, width * fit);
  pen.beginPath();
  pen.moveTo(a.x, a.y);
  pen.lineTo(b.x, b.y);
  pen.stroke();
}

function fillQuad(
  pen: CanvasRenderingContext2D,
  at: At,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: string,
): void {
  const a = at(x0, y0);
  const b = at(x1, y0);
  const c = at(x1, y1);
  const d = at(x0, y1);
  pen.fillStyle = color;
  pen.beginPath();
  pen.moveTo(a.x, a.y);
  pen.lineTo(b.x, b.y);
  pen.lineTo(c.x, c.y);
  pen.lineTo(d.x, d.y);
  pen.closePath();
  pen.fill();
}

/** Front labrys on the hand plane. */
export function drawPixelAxePlane(
  pen: CanvasRenderingContext2D,
  at: At,
  fit: number,
  layout: PixelAxeLayout,
): void {
  const { haft, edge, head, socket, outline } = layout.colors;
  const [haftLo, haftHi] = layout.haft;
  const gy = layout.gripY;
  const yAt: At = (x, y) => at(x, y - gy);

  const wingPts = (sx: number): Array<[number, number]> => {
    const x = (v: number) => sx * Math.abs(v);
    const xa = x(layout.wingAttachX);
    const yb = layout.wingBottomY;
    return [
      [xa, yb],
      [xa, layout.wingY1],
      [x(layout.wingXTop), layout.wingY1],
      [x(layout.wingOutXMid), layout.wingOutY1],
      [x(layout.wingChevX), layout.wingChevY],
      [x(layout.wingOutXBot), yb],
      [x(layout.wingXBot), yb],
    ];
  };

  strokeLine(pen, yAt, fit, 0, haftLo, 0, haftHi, haft, layout.haftStroke);
  fillPoly(
    pen,
    yAt,
    [
      [0, haftLo],
      [-layout.pommelHalf, haftLo + layout.pommelRise],
      [layout.pommelHalf, haftLo + layout.pommelRise],
    ],
    haft,
  );

  fillQuad(pen, yAt, -layout.socketX, layout.socketY0, layout.socketX, layout.socketY1, socket);
  fillQuad(
    pen,
    yAt,
    -layout.socketInnerHalf,
    layout.socketCy - layout.socketInnerHalf,
    layout.socketInnerHalf,
    layout.socketCy + layout.socketInnerHalf,
    outline,
  );

  for (const sx of [-1, 1] as const) {
    const pts = wingPts(sx);
    fillPoly(pen, yAt, pts, head);
    strokeWingBladeEdge(pen, yAt, fit, pts, edge, layout.wingEdgeStroke);
  }

  fillQuad(pen, yAt, -layout.capHalf, layout.socketY1, layout.capHalf, layout.capY1, socket);

  strokeLine(pen, yAt, fit, -layout.socketX, layout.socketY0, layout.socketX, layout.socketY0, edge);
  strokeLine(pen, yAt, fit, -layout.socketX, layout.socketY0, -layout.socketX, layout.socketY1, edge, 0.38);
  strokeLine(pen, yAt, fit, layout.socketX, layout.socketY0, layout.socketX, layout.socketY1, edge, 0.38);

  if (layout.twoHand) {
    const h = yAt(0, layout.offhandGripY);
    const r = Math.max(1.2, 2.4 * fit);
    pen.fillStyle = "#c8a882";
    pen.beginPath();
    pen.arc(h.x, h.y, r, 0, Math.PI * 2);
    pen.fill();
  }
}

export function drawBronzeAxePlane(
  pen: CanvasRenderingContext2D,
  at: At,
  fit: number,
): void {
  drawPixelAxePlane(pen, at, fit, LAYOUTS.ba_bronze_axe!);
}

export function drawPixelAxePlaneForGearId(
  pen: CanvasRenderingContext2D,
  at: At,
  fit: number,
  gearId: string,
): void {
  const lay = pixelAxeLayoutForGearId(gearId);
  if (lay) drawPixelAxePlane(pen, at, fit, lay);
}

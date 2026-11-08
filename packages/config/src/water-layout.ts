/** Packed river spines + fall spans (`WFL1`). Shared by Forest Basin and Pale Hollow. */

export type WaterFallSpan = {
  lipX: number;
  lipZ: number;
  lipY: number;
  lipW: number;
  poolX: number;
  poolZ: number;
  poolY: number;
  poolW: number;
};

/** Little-endian WFL1: magic, nseg, nfall, then 6 f32 per seg and 8 f32 per fall. */
export function encodeWaterLayout(
  segs: readonly number[],
  falls: readonly WaterFallSpan[] = [],
): Uint8Array {
  const buf = new Uint8Array(8 + segs.length * 4 + falls.length * 32);
  const v = new DataView(buf.buffer);
  buf[0] = 0x57; // W
  buf[1] = 0x46; // F
  buf[2] = 0x4c; // L
  buf[3] = 0x31; // 1
  v.setUint16(4, segs.length / 6, true);
  v.setUint16(6, falls.length, true);
  let o = 8;
  for (const n of segs) {
    v.setFloat32(o, n, true);
    o += 4;
  }
  for (const f of falls) {
    for (const n of [f.lipX, f.lipZ, f.lipY, f.lipW, f.poolX, f.poolZ, f.poolY, f.poolW]) {
      v.setFloat32(o, n, true);
      o += 4;
    }
  }
  return buf;
}

/**
 * Canonical ERC-1155 ids matching `ItemIds.sol` / engine `ids.rs`.
 * Catalog craft defs keep small-int `id` + `slug`; chain export/import/AH use these.
 *
 * Fungible: keccak256(0x00 || slugUtf8)
 * Unique:   keccak256(0x01 || slugUtf8 || instanceId u64 BE)
 */
import { keccak256, toBytes, type Hex } from "viem";

const FUNGIBLE_TAG = 0x00;
const UNIQUE_TAG = 0x01;

function concatBytes(parts: Uint8Array[]): Uint8Array {
  let len = 0;
  for (const p of parts) len += p.length;
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Fungible chain id for a catalog slug (kebab-case, locked once registered). */
export function chainFungibleId(slug: string): bigint {
  if (!slug) throw new Error("empty slug");
  const raw = concatBytes([new Uint8Array([FUNGIBLE_TAG]), toBytes(slug)]);
  return BigInt(keccak256(raw));
}

/** Unique chain id for (slug, instanceId). */
export function chainUniqueId(slug: string, instanceId: number | bigint): bigint {
  if (!slug) throw new Error("empty slug");
  const n = BigInt(instanceId);
  if (n < 0n || n > 0xffffffffffffffffn) throw new Error("instanceId out of u64 range");
  const be = new Uint8Array(8);
  let x = n;
  for (let i = 7; i >= 0; i--) {
    be[i] = Number(x & 0xffn);
    x >>= 8n;
  }
  const raw = concatBytes([new Uint8Array([UNIQUE_TAG]), toBytes(slug), be]);
  return BigInt(keccak256(raw));
}

/** Hex string form (0x…) for RPC / logs. */
export function chainFungibleIdHex(slug: string): Hex {
  return `0x${chainFungibleId(slug).toString(16).padStart(64, "0")}` as Hex;
}

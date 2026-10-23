/** EIP-4361-style signed login for the local game server. */
import { randomBytes } from "node:crypto";
import { createPublicClient, http, verifyMessage, type Hex } from "viem";
import { envSettlementChainId } from "./settlement-chain";

const NONCE_TTL_MS = 5 * 60_000;
/** Pending challenges one connection may hold at once. Applies to every address. */
export const AUTH_PENDING_PER_CONNECTION = 5;
/**
 * Pending challenges one non-loopback address may hold.
 * Kept below the global cap so a single remote IP cannot fill it.
 */
export const AUTH_PENDING_PER_IP = 20;
/** Pending challenges across non-loopback addresses. Loopback does not spend this. */
export const AUTH_PENDING_GLOBAL = 100;
/** auth/hello attempts allowed per connection in the window below. */
export const AUTH_HELLO_LIMIT = 10;
/** auth/hello attempts allowed per non-loopback address in the window below. */
export const AUTH_HELLO_PER_IP = 40;
/** Distinct remote connections remembered in the hello tracker for one address. */
export const AUTH_HELLO_CONNECTIONS_PER_IP = 20;
export const AUTH_HELLO_WINDOW_MS = 60_000;
/** Remote hello-tracker entries. Loopback connections are not stored here. */
const MAX_HELLO_TRACKED = 200;

/**
 * Vite prefers 5173 but silently bumps (5174, 5175, …) when that port is taken.
 * Allow common local fallbacks so wallet login is not stuck after Connect.
 * More origins can be added with AUTH_ORIGINS (comma-separated).
 */
const VITE_DEV_PORTS = [5173, 5174, 5175, 5176, 5177, 5178, 5179, 5180] as const;
export const DEFAULT_AUTH_ORIGINS = VITE_DEV_PORTS.flatMap((port) => [
  `http://localhost:${port}`,
  `http://127.0.0.1:${port}`,
]);

type PendingNonce = {
  wallet: string;
  message: string;
  expiresAt: number;
  connectionId: string;
  clientIp: string;
};

type HelloRow = {
  ip: string;
  hits: number[];
};

const usedNonces = new Map<string, number>();
const pendingNonces = new Map<string, PendingNonce>();
const remoteHellos = new Map<string, HelloRow>();
const loopbackHellos = new Map<string, number[]>();

/**
 * Canonicalize an IP address to prevent rate-limit bypass via non-canonical forms.
 * IPv4: removes leading zeros (192.168.001.001 → 192.168.1.1)
 * IPv6: RFC 5952 canonical form (lowercase, :: for longest zero run, no leading zeros)
 */
export function normalizeIp(ip: string): string {
  const trimmed = ip.trim().toLowerCase();

  // Handle IPv4-mapped IPv6 (::ffff:192.168.1.1)
  if (trimmed.startsWith("::ffff:")) {
    const v4 = trimmed.slice("::ffff:".length);
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(v4)) {
      return canonicalizeIpv4(v4);
    }
  }

  // Pure IPv4
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(trimmed)) {
    return canonicalizeIpv4(trimmed);
  }

  // IPv6
  if (trimmed.includes(":")) {
    return canonicalizeIpv6(trimmed);
  }

  return trimmed;
}

/** Canonicalize IPv4: remove leading zeros from each octet. */
function canonicalizeIpv4(ip: string): string {
  const octets = ip.split(".");
  if (octets.length !== 4) return ip;
  const parsed = octets.map((o) => {
    const n = parseInt(o, 10);
    return Number.isNaN(n) || n < 0 || n > 255 ? null : n;
  });
  if (parsed.some((n) => n === null)) return ip;
  return parsed.join(".");
}

/**
 * Canonicalize IPv6 per RFC 5952:
 * - Lowercase hex
 * - No leading zeros in groups
 * - :: for longest run of zero groups (first if tied)
 */
function canonicalizeIpv6(ip: string): string {
  let addr = ip.toLowerCase();
  // Strip zone ID (e.g., %eth0)
  const zoneIdx = addr.indexOf("%");
  if (zoneIdx !== -1) addr = addr.slice(0, zoneIdx);

  // Expand :: to full form
  let parts: string[];
  if (addr.includes("::")) {
    const [left, right] = addr.split("::");
    const leftParts = left ? left.split(":") : [];
    const rightParts = right ? right.split(":") : [];
    const missing = 8 - leftParts.length - rightParts.length;
    if (missing < 0) return ip; // invalid
    parts = [...leftParts, ...Array(missing).fill("0"), ...rightParts];
  } else {
    parts = addr.split(":");
  }

  if (parts.length !== 8) return ip; // invalid

  // Parse each group, removing leading zeros
  const groups = parts.map((p) => {
    const n = parseInt(p || "0", 16);
    return Number.isNaN(n) ? 0 : n;
  });

  // Find longest run of zeros for :: compression
  let bestStart = -1;
  let bestLen = 0;
  let runStart = -1;
  let runLen = 0;
  for (let i = 0; i < 8; i++) {
    if (groups[i] === 0) {
      if (runStart === -1) runStart = i;
      runLen++;
    } else {
      if (runLen > bestLen) {
        bestStart = runStart;
        bestLen = runLen;
      }
      runStart = -1;
      runLen = 0;
    }
  }
  if (runLen > bestLen) {
    bestStart = runStart;
    bestLen = runLen;
  }

  // Build canonical form
  const hex = groups.map((n) => n.toString(16));
  if (bestLen >= 2) {
    const before = hex.slice(0, bestStart);
    const after = hex.slice(bestStart + bestLen);
    if (before.length === 0 && after.length === 0) return "::";
    if (before.length === 0) return "::" + after.join(":");
    if (after.length === 0) return before.join(":") + "::";
    return before.join(":") + "::" + after.join(":");
  }
  return hex.join(":");
}

export function isLoopbackIp(ip: string): boolean {
  const n = normalizeIp(ip);
  return n === "127.0.0.1" || n === "::1";
}

function trustsProxy(env: Record<string, string | undefined>): boolean {
  const value = (env.AUTH_TRUST_PROXY ?? "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

/**
 * Socket remote address by default.
 * X-Forwarded-For is used only when AUTH_TRUST_PROXY is explicitly on.
 * M-3: take the right-most untrusted hop (left entries are client-spoofable).
 */
export function clientAddress(
  req: {
    headers: { [key: string]: string | string[] | undefined };
    socket: { remoteAddress?: string | null };
  },
  env: Record<string, string | undefined> = process.env,
): string {
  const remote = normalizeIp(req.socket.remoteAddress ?? "");
  if (!trustsProxy(env)) return remote;
  const header = req.headers["x-forwarded-for"];
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw) return remote;
  const hops = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (hops.length === 0) return remote;
  // Right-most hop is the one appended by the trusted proxy nearest the app.
  const last = hops[hops.length - 1]!;
  return normalizeIp(last);
}

function canonicalOrigin(value: string): { origin: string; domain: string } | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (url.pathname !== "/" && url.pathname !== "") return null;
  if (url.search || url.hash) return null;
  return { origin: url.origin, domain: url.host };
}

/** Local defaults plus AUTH_ORIGINS. Not a secret. */
export function authAllowlist(env: Record<string, string | undefined> = process.env): string[] {
  const extras = (env.AUTH_ORIGINS ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of [...DEFAULT_AUTH_ORIGINS, ...extras]) {
    const canon = canonicalOrigin(entry);
    if (!canon || seen.has(canon.origin)) continue;
    seen.add(canon.origin);
    out.push(canon.origin);
  }
  return out;
}

export function resolveAuthOrigin(
  originHeader: string | undefined,
  allowlist: readonly string[],
): { ok: true; origin: string; domain: string } | { ok: false; error: string } {
  if (!originHeader || !originHeader.trim()) {
    return { ok: false, error: "Origin required." };
  }
  const presented = canonicalOrigin(originHeader.trim());
  if (!presented) return { ok: false, error: "Origin is not allowed." };
  for (const entry of allowlist) {
    const allowed = canonicalOrigin(entry);
    if (allowed && allowed.origin === presented.origin) {
      return { ok: true, origin: presented.origin, domain: presented.domain };
    }
  }
  return { ok: false, error: "Origin is not allowed." };
}

/** True when the websocket upgrade Origin is on the allowlist. Missing Origin is rejected. */
export function authVerifyClient(
  info: { origin?: string | string[] },
  env: Record<string, string | undefined> = process.env,
): boolean {
  const origin = Array.isArray(info.origin) ? info.origin[0] : info.origin;
  return resolveAuthOrigin(origin, authAllowlist(env)).ok;
}

function pruneHellos(map: Map<string, HelloRow>, now: number) {
  for (const [id, row] of map) {
    const fresh = row.hits.filter((t) => now - t < AUTH_HELLO_WINDOW_MS);
    if (fresh.length === 0) map.delete(id);
    else if (fresh.length !== row.hits.length) row.hits = fresh;
  }
}

function prune(now = Date.now()) {
  for (const [nonce, exp] of usedNonces) {
    if (exp <= now) usedNonces.delete(nonce);
  }
  for (const [nonce, row] of pendingNonces) {
    if (row.expiresAt <= now) pendingNonces.delete(nonce);
  }
  pruneHellos(remoteHellos, now);
  for (const [id, hits] of loopbackHellos) {
    const fresh = hits.filter((t) => now - t < AUTH_HELLO_WINDOW_MS);
    if (fresh.length === 0) loopbackHellos.delete(id);
    else if (fresh.length !== hits.length) loopbackHellos.set(id, fresh);
  }
}

function pendingFor(connectionId: string): number {
  let n = 0;
  for (const row of pendingNonces.values()) {
    if (row.connectionId === connectionId) n += 1;
  }
  return n;
}

function pendingForIp(clientIp: string): number {
  let n = 0;
  for (const row of pendingNonces.values()) {
    if (row.clientIp === clientIp) n += 1;
  }
  return n;
}

function pendingGlobal(countLoopback = false): number {
  let n = 0;
  for (const row of pendingNonces.values()) {
    if (countLoopback || !isLoopbackIp(row.clientIp)) n += 1;
  }
  return n;
}

function allowHello(
  connectionId: string,
  clientIp: string,
  now: number,
  /** When true, treat loopback like a remote IP (AUTH_TRUST_PROXY / M-3). */
  countLoopback = false,
): boolean {
  if (isLoopbackIp(clientIp) && !countLoopback) {
    const hits = (loopbackHellos.get(connectionId) ?? []).filter((t) => now - t < AUTH_HELLO_WINDOW_MS);
    if (hits.length >= AUTH_HELLO_LIMIT) {
      loopbackHellos.set(connectionId, hits);
      return false;
    }
    hits.push(now);
    loopbackHellos.set(connectionId, hits);
    return true;
  }
  const existing = remoteHellos.get(connectionId);
  const hits = (existing?.hits ?? []).filter((t) => now - t < AUTH_HELLO_WINDOW_MS);
  if (!existing) {
    if (remoteHellos.size >= MAX_HELLO_TRACKED) return false;
    let tracked = 0;
    for (const row of remoteHellos.values()) {
      if (row.ip === clientIp) tracked += 1;
    }
    if (tracked >= AUTH_HELLO_CONNECTIONS_PER_IP) return false;
  }
  if (hits.length >= AUTH_HELLO_LIMIT) {
    remoteHellos.set(connectionId, { ip: clientIp, hits });
    return false;
  }
  let ipHits = hits.length;
  for (const [id, row] of remoteHellos) {
    if (id === connectionId || row.ip !== clientIp) continue;
    ipHits += row.hits.filter((t) => now - t < AUTH_HELLO_WINDOW_MS).length;
  }
  if (ipHits >= AUTH_HELLO_PER_IP) {
    if (existing) remoteHellos.set(connectionId, { ip: clientIp, hits });
    return false;
  }
  hits.push(now);
  remoteHellos.set(connectionId, { ip: clientIp, hits });
  return true;
}

export function isEthAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}

export function authMessage(args: {
  wallet: string;
  nonce: string;
  issuedAt: string;
  expirationTime?: string;
  chainId?: number;
  uri?: string;
  domain?: string;
  /** Statement line under the address (EIP-4361). */
  statement?: string;
}): string {
  const wallet = args.wallet.toLowerCase();
  const uri = args.uri ?? "https://blackanvil.gg";
  const chainId = args.chainId ?? 31337;
  const domain = (args.domain ?? "localhost").trim() || "localhost";
  const expirationTime = args.expirationTime ?? new Date(Date.now() + NONCE_TTL_MS).toISOString();
  const statement = (args.statement ?? "Sign in to Black Anvil.").trim();
  return [
    domain + " wants you to sign in with your Ethereum account:",
    wallet,
    "",
    statement,
    "",
    "URI: " + uri,
    "Version: 1",
    "Chain ID: " + chainId,
    "Nonce: " + args.nonce,
    "Issued At: " + args.issuedAt,
    "Expiration Time: " + expirationTime,
  ].join("\n");
}

export type AuthChallengeOpts = {
  /** Websocket that asked for this nonce. A different socket cannot redeem it. */
  connectionId?: string;
  /** SIWE domain: host of the allowlisted Origin, never a client Host header. */
  domain?: string;
  /** Full allowlisted Origin used as SIWE URI. */
  uri?: string;
  /** Settlement chain id (Gnosis 100, Chiado 10200, anvil 31337). */
  chainId?: number;
  /** Normalized socket address. Loopback does not spend the global budget. */
  clientIp?: string;
  /** When true (AUTH_TRUST_PROXY), loopback still spends IP/global budgets (M-3). */
  countLoopback?: boolean;
  now?: number;
  env?: NodeJS.ProcessEnv;
};

function authUriForDomain(domain: string, uri?: string): string {
  if (uri && /^https?:\/\//i.test(uri)) return uri;
  if (domain === "localhost" || domain.startsWith("localhost:") || domain.startsWith("127.0.0.1")) {
    return "http://" + domain;
  }
  return "https://" + domain;
}

export function issueAuthChallenge(
  wallet: string,
  opts: AuthChallengeOpts = {},
): { ok: true; nonce: string; issuedAt: string; message: string } | { ok: false; error: string } {
  const now = opts.now ?? Date.now();
  prune(now);
  const addr = wallet.trim().toLowerCase();
  if (!isEthAddress(addr)) {
    return { ok: false, error: "Wallet must be a 0x address." };
  }
  const connectionId = opts.connectionId ?? "";
  const clientIp = normalizeIp(opts.clientIp ?? "");
  const countLoopback =
    opts.countLoopback === true ||
    trustsProxy((opts.env ?? process.env) as Record<string, string | undefined>);
  if (pendingFor(connectionId) >= AUTH_PENDING_PER_CONNECTION) {
    return { ok: false, error: "Too many pending login challenges." };
  }
  if (countLoopback || !isLoopbackIp(clientIp)) {
    if (pendingForIp(clientIp) >= AUTH_PENDING_PER_IP) {
      return { ok: false, error: "Too many pending login challenges." };
    }
    if (pendingGlobal(countLoopback) >= AUTH_PENDING_GLOBAL) {
      return { ok: false, error: "Too many pending login challenges." };
    }
  }
  if (!allowHello(connectionId, clientIp, now, countLoopback)) {
    return { ok: false, error: "Too many login challenges. Wait a moment." };
  }
  const nonce = randomBytes(16).toString("hex");
  const issuedAt = new Date(now).toISOString();
  const expiresAt = now + NONCE_TTL_MS;
  const domain = (opts.domain ?? "localhost").trim() || "localhost";
  const chainId = opts.chainId ?? envSettlementChainId(opts.env ?? process.env);
  const message = authMessage({
    wallet: addr,
    nonce,
    issuedAt,
    expirationTime: new Date(expiresAt).toISOString(),
    domain,
    chainId,
    uri: authUriForDomain(domain, opts.uri),
    statement: "Sign in to Black Anvil.",
  });
  pendingNonces.set(nonce, { wallet: addr, message, expiresAt, connectionId, clientIp });
  return { ok: true, nonce, issuedAt, message };
}

export async function verifyAuthLogin(args: {
  wallet: string;
  signature: string;
  nonce: string;
  message: string;
  /** Must be the connection that received the challenge. */
  connectionId?: string;
  env?: NodeJS.ProcessEnv;
}): Promise<{ ok: true; wallet: string } | { ok: false; error: string }> {
  const now = Date.now();
  prune(now);
  const wallet = args.wallet.trim().toLowerCase();
  if (!isEthAddress(wallet)) {
    return { ok: false, error: "Wallet must be a 0x address." };
  }
  if (!args.signature || typeof args.signature !== "string") {
    return { ok: false, error: "Signature required." };
  }
  const pending = pendingNonces.get(args.nonce);
  if (!pending || pending.expiresAt <= now) {
    if (pending) pendingNonces.delete(args.nonce);
    if (usedNonces.has(args.nonce)) {
      return { ok: false, error: "Login nonce was already used." };
    }
    return { ok: false, error: "Login nonce is unknown or expired." };
  }
  if (pending.wallet !== wallet) {
    return { ok: false, error: "Login nonce belongs to another wallet." };
  }
  const connectionId = args.connectionId ?? "";
  if (pending.connectionId !== connectionId) {
    return { ok: false, error: "Login nonce belongs to another connection." };
  }
  if (args.message !== pending.message) {
    return { ok: false, error: "Signed message does not match this login." };
  }
  // Consume before the signature await so two in-flight auths cannot both pass.
  pendingNonces.delete(args.nonce);
  usedNonces.set(args.nonce, now + NONCE_TTL_MS);
  let valid = false;
  try {
    // M-4: prefer publicClient.verifyMessage (ERC-1271 / smart wallets) when RPC is set.
    const env = args.env ?? process.env;
    const rpc = env.LOK_CHAIN_RPC?.trim() || env.LOK_PUBLIC_RPC?.trim();
    const chainId = envSettlementChainId(env);
    if (rpc) {
      const pub = createPublicClient({
        chain: {
          id: chainId,
          name: "settlement",
          nativeCurrency: { name: "xDAI", symbol: "xDAI", decimals: 18 },
          rpcUrls: { default: { http: [rpc] } },
        },
        transport: http(rpc),
      });
      valid = await pub.verifyMessage({
        address: wallet as `0x${string}`,
        message: args.message,
        signature: args.signature as Hex,
      });
    } else {
      valid = await verifyMessage({
        address: wallet as `0x${string}`,
        message: args.message,
        signature: args.signature as Hex,
      });
    }
  } catch {
    return { ok: false, error: "Signature could not be checked." };
  }
  if (!valid) return { ok: false, error: "Signature is invalid." };
  return { ok: true, wallet };
}

/** How long a signed-in page may reconnect without another wallet prompt. */
const RESUME_TTL_MS = 12 * 60 * 60_000;
const resumes = new Map<string, { wallet: string; expiresAt: number }>();
const resumeByWallet = new Map<string, string>();

/**
 * A session credential issued only after a valid login signature.
 * The same token is reused until it expires, so a socket blip does not pop the wallet.
 */
export function issueAuthResume(wallet: string, now = Date.now()): string {
  const id = wallet.toLowerCase();
  const existing = resumeByWallet.get(id);
  if (existing) {
    const row = resumes.get(existing);
    if (row && row.expiresAt > now) return existing;
    resumes.delete(existing);
  }
  const token = randomBytes(32).toString("hex");
  resumes.set(token, { wallet: id, expiresAt: now + RESUME_TTL_MS });
  resumeByWallet.set(id, token);
  return token;
}

/** True only for the wallet that signed, and only before the token expires. */
export function acceptAuthResume(
  token: string,
  wallet: string,
  now = Date.now(),
): { ok: true; wallet: string } | { ok: false; error: string } {
  const row = resumes.get(token);
  if (!row || row.expiresAt <= now || row.wallet !== wallet.toLowerCase()) {
    return { ok: false, error: "Sign in again." };
  }
  return { ok: true, wallet: row.wallet };
}

export function dropAuthResume(wallet: string) {
  const id = wallet.toLowerCase();
  const token = resumeByWallet.get(id);
  if (token) resumes.delete(token);
  resumeByWallet.delete(id);
}

/** Drop challenges and hello budget when a websocket closes. */
export function dropAuthConnection(connectionId: string) {
  if (!connectionId) return;
  for (const [nonce, row] of pendingNonces) {
    if (row.connectionId === connectionId) pendingNonces.delete(nonce);
  }
  remoteHellos.delete(connectionId);
  loopbackHellos.delete(connectionId);
}

/** Test helper: mark a nonce used without verifying. */
export function __resetAuthNoncesForTests() {
  usedNonces.clear();
  pendingNonces.clear();
  remoteHellos.clear();
  loopbackHellos.clear();
  resumes.clear();
  resumeByWallet.clear();
}

/** Test helper: drop pending rows but keep the hello rate window. */
export function __clearPendingChallengesForTests() {
  pendingNonces.clear();
}

/** Test helper: force a pending challenge to look expired. */
export function __expirePendingForTests(nonce: string) {
  const row = pendingNonces.get(nonce);
  if (row) row.expiresAt = Date.now() - 1;
}

/**
 * WebSocket DoS limits (M-3): maxPayload, per-socket message rate, per-IP connections, auth deadline.
 */
import { isLoopbackIp, normalizeIp } from "./wallet-auth";

export const WS_MAX_PAYLOAD = 64 * 1024;
/** Messages per socket per window before disconnect. */
export const WS_MSG_LIMIT = 120;
export const WS_MSG_WINDOW_MS = 10_000;
/** Concurrent connections per remote IP (non-exempt). */
export const WS_MAX_CONNECTIONS_PER_IP = 20;
/** Unauthenticated sockets must complete auth within this window. */
export const WS_AUTH_DEADLINE_MS = 30_000;

type MsgBucket = { count: number; resetAt: number };

const msgBuckets = new Map<object, MsgBucket>();
const ipConnections = new Map<string, number>();

export function noteWsConnect(ip: string): { ok: true } | { ok: false; error: string } {
  const key = normalizeIp(ip) || "unknown";
  const n = (ipConnections.get(key) ?? 0) + 1;
  if (n > WS_MAX_CONNECTIONS_PER_IP) {
    return { ok: false, error: "Too many connections from this address." };
  }
  ipConnections.set(key, n);
  return { ok: true };
}

export function noteWsDisconnect(ip: string): void {
  const key = normalizeIp(ip) || "unknown";
  const n = (ipConnections.get(key) ?? 0) - 1;
  if (n <= 0) ipConnections.delete(key);
  else ipConnections.set(key, n);
}

/**
 * Consume one message from the socket rate budget.
 * Returns false when over limit (caller should close).
 */
export function consumeWsMessage(sock: object, now = Date.now()): boolean {
  const row = msgBuckets.get(sock);
  if (!row || now >= row.resetAt) {
    msgBuckets.set(sock, { count: 1, resetAt: now + WS_MSG_WINDOW_MS });
    return true;
  }
  if (row.count >= WS_MSG_LIMIT) return false;
  row.count += 1;
  return true;
}

export function clearWsMessageBudget(sock: object): void {
  msgBuckets.delete(sock);
}

/** When TRUST_PROXY is on, loopback must still count toward IP caps (proxy looks local). */
export function wsIpExemptFromCaps(
  ip: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const trust =
    (env.AUTH_TRUST_PROXY ?? "").trim().toLowerCase() === "1" ||
    (env.AUTH_TRUST_PROXY ?? "").trim().toLowerCase() === "true" ||
    (env.AUTH_TRUST_PROXY ?? "").trim().toLowerCase() === "yes" ||
    (env.AUTH_TRUST_PROXY ?? "").trim().toLowerCase() === "on";
  if (trust) return false;
  return isLoopbackIp(ip);
}

export function resetWsLimitsForTests(): void {
  msgBuckets.clear();
  ipConnections.clear();
}

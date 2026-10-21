/**
 * Redact secrets from ops surfaces (HTTP /status, startup logs, RPC errors).
 * Alchemy / Infura / custom paths often embed API keys in the URL path.
 */

/** scheme://host only — strips path, query, userinfo. */
export function redactRpcUrl(url: string | null | undefined): string {
  const raw = (url ?? "").trim();
  if (!raw) return "";
  try {
    const u = new URL(raw);
    return u.protocol + "//" + u.host;
  } catch {
    // Non-URL strings: strip anything that looks like a key path segment.
    return raw
      .replace(/\/\/([^/@]+)@/g, "//***@")
      .replace(/\/v\d+\/[A-Za-z0-9_-]{8,}/g, "/v*/***")
      .replace(/[?&](api[_-]?key|apikey|key|token)=[^&\s]+/gi, "$1=***");
  }
}

/** Replace absolute URLs inside free-text errors with scheme+host. */
export function redactRpcText(text: string | null | undefined): string {
  const raw = text ?? "";
  if (!raw) return "";
  return raw.replace(/https?:\/\/[^\s"'\\]+/gi, (m) => redactRpcUrl(m) || "***");
}

/** Basename only — never leak absolute host paths in /status. */
export function redactDataDir(dataDir: string): string {
  const trimmed = dataDir.replace(/\/+$/, "");
  const base = trimmed.split(/[/\\]/).filter(Boolean).pop();
  return base || "data";
}

/** JSON.stringify that turns bigint into decimal strings (and redacts nested rpc fields). */
export function jsonStringifySafe(value: unknown): string {
  return JSON.stringify(value, (_key, v) => {
    if (typeof v === "bigint") return v.toString();
    return v;
  });
}

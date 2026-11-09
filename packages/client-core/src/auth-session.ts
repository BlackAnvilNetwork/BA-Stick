/**
 * Last signed-in wallet + server resume token.
 * Survives refresh so auth/resume can skip a new signature while the token is live.
 */
const AUTH_SESSION_KEY = "bellgrave.authSession";
const WALLET_RE = /^0x[0-9a-fA-F]{40}$/;
const TOKEN_RE = /^[0-9a-f]{64}$/;

export type AuthSession = {
  wallet: `0x${string}`;
  resumeToken: string | null;
};

function storage(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function loadAuthSession(): AuthSession | null {
  const raw = storage()?.getItem(AUTH_SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (typeof parsed.wallet !== "string" || !WALLET_RE.test(parsed.wallet)) return null;
    const token =
      typeof parsed.resumeToken === "string" && TOKEN_RE.test(parsed.resumeToken)
        ? parsed.resumeToken
        : null;
    return { wallet: parsed.wallet.toLowerCase() as `0x${string}`, resumeToken: token };
  } catch {
    return null;
  }
}

export function saveAuthSession(session: AuthSession): void {
  if (!WALLET_RE.test(session.wallet)) return;
  const resumeToken =
    session.resumeToken && TOKEN_RE.test(session.resumeToken) ? session.resumeToken : null;
  try {
    storage()?.setItem(
      AUTH_SESSION_KEY,
      JSON.stringify({
        wallet: session.wallet.toLowerCase(),
        resumeToken,
      }),
    );
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearAuthSession(): void {
  try {
    storage()?.removeItem(AUTH_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/** Keep the wallet so a later silent reconnect can sign; drop a dead resume token. */
export function clearResumeTokenKeepWallet(): void {
  const session = loadAuthSession();
  if (!session) return;
  saveAuthSession({ wallet: session.wallet, resumeToken: null });
}

export function hasPersistedWalletAuth(): boolean {
  return loadAuthSession() != null;
}

/** Other tabs: logout in tab B must drop tab A's in-memory session. */
export function subscribeAuthSessionStorage(
  onChange: (session: AuthSession | null) => void,
): () => void {
  if (typeof window === "undefined" || typeof window.addEventListener !== "function") {
    return () => {};
  }
  const handler = (e: StorageEvent) => {
    if (e.key != null && e.key !== AUTH_SESSION_KEY) return;
    onChange(loadAuthSession());
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

/** True only when the persisted row is this address — not "any connected non-burner". */
export function hasPersistedAuthForWallet(address: string): boolean {
  if (!WALLET_RE.test(address)) return false;
  const session = loadAuthSession();
  return !!session && session.wallet === address.toLowerCase();
}

/** Keep a resume token only when it already belongs to this wallet. */
export function resumeTokenForWallet(wallet: string, fallback: string | null = null): string | null {
  if (!WALLET_RE.test(wallet)) return null;
  const addr = wallet.toLowerCase();
  const session = loadAuthSession();
  if (session && session.wallet !== addr) return null;
  if (session?.resumeToken) return session.resumeToken;
  if (fallback && TOKEN_RE.test(fallback)) return fallback;
  return null;
}

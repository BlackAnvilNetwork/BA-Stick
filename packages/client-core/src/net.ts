import type { ClientMessage, ServerMessage } from "@bellgrave/protocol";
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import {
  appKitConfigured,
  connectWithAppKit,
  disconnectAppKit,
  sessionFromConnectedAppKit,
  sessionFromRestoredAppKit,
} from "./appkit";
import {
  clearAuthSession,
  clearResumeTokenKeepWallet,
  loadAuthSession,
  resumeTokenForWallet,
  saveAuthSession,
} from "./auth-session";
import { burnerIdentityAllowed, isStoredLocalBurnerWallet } from "./burner-identity";
import { adoptInjectedWallet, connectInjectedWallet, injectedWalletAvailable } from "./injected-login";
import { clearPendingMint, clearPendingMintIfTokenBound } from "./pending-mint";
import { setReplicaAllowlist } from "./light-client";
import { ReqWaiters } from "./req-waiters";
import {
  createEnterIdAfterAuthOk,
  hydratedResumeToken,
  shouldAdoptLiveWallet,
  shouldAllowSilentHello,
  shouldApplyCreateSnapshotHud,
  shouldBeginAuthHello,
  shouldClaimStarterOnSnapshot,
  shouldClearPendingCreateEnterOnAuthOk,
  shouldKickLeftoverBurnerOnAuthOk,
  shouldRefuseLeftoverBurnerSession,
  phaseAfterOwnedRoster,
  shouldRequestOwnedNftSync,
  shouldResetSessionOnWalletSwitch,
  shouldStayOnCreateAfterAuthOk,
} from "./net-leftovers";
import { useGame } from "./state";
import { setPreferredPayoutWallet } from "./wallet";
import { defaultRpcUrl, walletConnectConfigured } from "./walletconnect";
import { isWalletDisconnectedError, WALLET_DISCONNECTED_HINT } from "./wallet-provider";

/** Prefer same hostname as the page so localhost vs 127.0.0.1 stay consistent for WS Origin. */
function defaultWsUrl(): string {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  if (typeof window !== "undefined" && window.location?.hostname) {
    const host = window.location.hostname;
    const authority = host.includes(":") ? `[${host}]` : host;
    return `ws://${authority}:8787`;
  }
  return "ws://127.0.0.1:8787";
}
const WS_URL = defaultWsUrl();
const HEARTBEAT_MS = 20_000;
const RESUME_KEY = "bellgrave.resumeChar";
const WALLET_KEY = "bellgrave.wallet";
const PK_KEY = "bellgrave.walletKey";

let socket: WebSocket | null = null;
let authedWallet: string | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
/** Character to re-enter after a soft disconnect while in play. */
let resumeCharId: string | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let visibilityBound = false;
/** User chose Logout — drop the live session and do not auto-enter the character. */
let intentionalLogout = false;
let authInFlight = false;
let authInFlightWallet: string | null = null;
/** Set only after the server accepted a signature. A reconnect presents this instead of signing. */
let resumeToken: string | null = null;
let resumeAttempt = false;
/** Set by the Connect button so the next socket open may ask for a signature. */
let signOnNextOpen = false;
/** One silent hello after a forgotten server session (not after the player dismisses sign). */
let allowSilentHello = false;
let restoreInFlight = false;
let restorePromise: Promise<boolean> | null = null;
/** Logout cleared the session — do not adopt the still-warm AppKit pairing. */
let skipRestoreUntilConnect = false;
let nameCheckWaiter:
  | {
      resolve: (r: { ok: true; name: string } | { ok: false; error: string }) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  | null = null;
type FillReply = { ok: true; epoch: number } | { ok: false; error: string };
/** One slot per ah/admitFill|pinFill|releaseFill request, keyed by `req`. */
const fillWaiters = new ReqWaiters<FillReply>();

/** External wallet used for auth challenge signing (injected / WalletConnect). */
type ExternalAuth = {
  address: `0x${string}`;
  signMessage: (message: string) => Promise<string>;
};
let externalAuth: ExternalAuth | null = null;

function clearHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function startHeartbeat() {
  clearHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "ping", t: Date.now() } satisfies ClientMessage));
  }, HEARTBEAT_MS);
}

function rememberResume() {
  if (intentionalLogout) return;
  const g = useGame.getState();
  if (g.phase === "play" && g.selectedCharId) {
    resumeCharId = g.selectedCharId;
    try {
      localStorage.setItem(RESUME_KEY, g.selectedCharId);
    } catch {
      /* ignore */
    }
  }
}

function consumeResumeId(rosterIds: string[]): string | null {
  const stored = resumeCharId ?? (() => {
    try {
      return localStorage.getItem(RESUME_KEY);
    } catch {
      return null;
    }
  })();
  resumeCharId = null;
  if (!stored) return null;
  if (!rosterIds.includes(stored)) return null;
  return stored;
}

function clearResumeStorage() {
  try {
    localStorage.removeItem(RESUME_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Local anvil-style account kept in this browser. Never logged.
 * Disabled on Gnosis/Chiado — must not be game-auth identity (audit L-8 / C-1).
 */
function localAccount(): PrivateKeyAccount {
  if (!burnerIdentityAllowed()) {
    throw new Error(
      "Local burner identity is disabled on Gnosis/Chiado. Connect an injected wallet or Reown AppKit.",
    );
  }
  let key = localStorage.getItem(PK_KEY);
  const existingWallet = localStorage.getItem(WALLET_KEY);
  // Migrate mock 0xmvp… ids to a real secp256k1 account.
  if (!key || !existingWallet || !/^0x[0-9a-fA-F]{40}$/.test(existingWallet)) {
    key = generatePrivateKey();
    localStorage.setItem(PK_KEY, key);
  }
  const account = privateKeyToAccount(key as `0x${string}`);
  localStorage.setItem(WALLET_KEY, account.address);
  return account;
}

export function mockWallet(): string {
  return localAccount().address;
}

function markAuthInFlight(wallet: string | null) {
  if (wallet) {
    authInFlight = true;
    authInFlightWallet = wallet.toLowerCase();
    return;
  }
  authInFlight = false;
  authInFlightWallet = null;
}

function beginAuthHello(address: `0x${string}`, opts?: { force?: boolean }) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  const w = address.toLowerCase();
  if (
    !shouldBeginAuthHello({
      address,
      authInFlight,
      authInFlightWallet,
      alreadyAuthed: authedWallet === w && !!useGame.getState().wallet,
      force: opts?.force,
    })
  ) {
    return;
  }
  markAuthInFlight(address);
  socket.send(JSON.stringify({ type: "auth/hello", wallet: address } satisfies ClientMessage));
}

function beginAuthResume(address: `0x${string}`, token: string) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  if (authInFlight) return;
  markAuthInFlight(address);
  resumeAttempt = true;
  socket.send(
    JSON.stringify({
      type: "auth/resume",
      wallet: address,
      resumeToken: token,
    } satisfies ClientMessage),
  );
}

function hydrateAuthSession() {
  const session = loadAuthSession();
  resumeToken = hydratedResumeToken(session?.resumeToken);
  return session;
}

function resumeWallet(): `0x${string}` | null {
  if (externalAuth) return externalAuth.address;
  return hydrateAuthSession()?.wallet ?? null;
}

function waitRestoreExternalAuth(): Promise<boolean> {
  if (externalAuth) return Promise.resolve(true);
  if (restorePromise) return restorePromise;
  restoreInFlight = true;
  restorePromise = restoreExternalAuth()
    .then((ok) => ok)
    .catch(() => false)
    .finally(() => {
      restoreInFlight = false;
      restorePromise = null;
    });
  return restorePromise;
}

async function restoreExternalAuth(): Promise<boolean> {
  if (externalAuth) return true;
  const persisted = hydrateAuthSession()?.wallet;
  const prefer =
    persisted && !isStoredLocalBurnerWallet(persisted) ? persisted : undefined;
  const chainId = Number(import.meta.env.VITE_CHAIN_ID ?? "100");
  const rpcUrl = defaultRpcUrl(chainId);
  if (appKitConfigured()) {
    const session = await sessionFromRestoredAppKit({ chainId, rpcUrl, prefer, timeoutMs: 2500 });
    if (session) {
      externalAuth = {
        address: session.address,
        signMessage: (message) => session.client.signMessage({ message, account: session.account }),
      };
      return true;
    }
  }
  if (injectedWalletAvailable()) {
    const session = await adoptInjectedWallet({ chainId, rpcUrl, prefer });
    if (session) {
      externalAuth = {
        address: session.address,
        signMessage: (message) => session.client.signMessage({ message, account: session.account }),
      };
      return true;
    }
  }
  return false;
}

function dropGameSessionForWalletSwitch(): void {
  authedWallet = null;
  resumeCharId = null;
  resumeAttempt = false;
  markAuthInFlight(null);
  clearResumeStorage();
  const g = useGame.getState();
  g.setWallet(null);
  g.setCharacters([]);
  g.setHasCharacter(false);
  g.setSelectedCharId(null);
  g.setCharacterPreview(null);
  g.setPendingCreateEnter(false);
  g.clearSnapshot();
  g.setPhase("boot");
}

function refuseLeftoverBurnerAndStayOnAuth(): void {
  clearAuthSession();
  resumeToken = null;
  authedWallet = null;
  if (externalAuth && isStoredLocalBurnerWallet(externalAuth.address)) {
    externalAuth = null;
  }
  const g = useGame.getState();
  g.setWallet(null);
  g.setCharacters([]);
  g.setHasCharacter(false);
  g.setPendingCreateEnter(false);
  g.setPhase("auth");
}

/** Drop a leftover local burner game session and stay on auth until AppKit signs. */
export function kickLeftoverBurnerToAuth(): boolean {
  const g = useGame.getState();
  const session = g.wallet ?? loadAuthSession()?.wallet ?? externalAuth?.address ?? null;
  if (!session || !isStoredLocalBurnerWallet(session)) return false;
  refuseLeftoverBurnerAndStayOnAuth();
  g.pushLog(
    "Connect the wallet that minted. The leftover local browser wallet cannot play on Gnosis.",
  );
  return true;
}

function tryAutoAuth() {
  if (skipRestoreUntilConnect && !signOnNextOpen && !externalAuth) {
    useGame.getState().setPhase("auth");
    return;
  }
  const persisted = hydrateAuthSession();
  const live = externalAuth?.address ?? null;

  if (live && persisted && shouldAdoptLiveWallet(live, persisted.wallet)) {
    if (isStoredLocalBurnerWallet(persisted.wallet)) {
      clearAuthSession();
      resumeToken = null;
    }
    resumeToken = resumeTokenForWallet(live, null);
  }

  if (
    shouldRefuseLeftoverBurnerSession(
      persisted?.wallet,
      !!persisted && isStoredLocalBurnerWallet(persisted.wallet),
    ) &&
    (!live || isStoredLocalBurnerWallet(live))
  ) {
    refuseLeftoverBurnerAndStayOnAuth();
    return;
  }

  if (live && isStoredLocalBurnerWallet(live)) {
    refuseLeftoverBurnerAndStayOnAuth();
    return;
  }

  const wallet =
    (live && !isStoredLocalBurnerWallet(live) ? live : null) ??
    (persisted && !isStoredLocalBurnerWallet(persisted.wallet) ? persisted.wallet : null);
  const token = wallet ? resumeTokenForWallet(wallet, resumeToken) : null;
  resumeToken = token;

  if (wallet && token) {
    signOnNextOpen = false;
    beginAuthResume(wallet, token);
    if (!externalAuth) {
      void waitRestoreExternalAuth();
    }
    return;
  }

  if (signOnNextOpen && externalAuth && !isStoredLocalBurnerWallet(externalAuth.address)) {
    signOnNextOpen = false;
    beginAuthHello(externalAuth.address);
    return;
  }

  if (
    externalAuth &&
    allowSilentHello &&
    shouldAllowSilentHello("resume-miss") &&
    !isStoredLocalBurnerWallet(externalAuth.address)
  ) {
    allowSilentHello = false;
    beginAuthHello(externalAuth.address);
    return;
  }

  if (!externalAuth && (wallet || appKitConfigured() || injectedWalletAvailable())) {
    void waitRestoreExternalAuth().then((ok) => {
      if (ok) {
        tryAutoAuth();
        return;
      }
      if (!burnerIdentityAllowed()) useGame.getState().setPhase("auth");
      else beginAuthHello(localAccount().address);
    });
    return;
  }

  if (externalAuth) {
    useGame.getState().setPhase("auth");
    return;
  }
  if (!burnerIdentityAllowed()) {
    useGame.getState().setPhase("auth");
    return;
  }
  beginAuthHello(localAccount().address);
}

async function completeSignedAuth(msg: Extract<ServerMessage, { type: "auth/challenge" }>) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    markAuthInFlight(null);
    return;
  }
  try {
    let signature: string;
    let wallet: `0x${string}`;
    if (externalAuth && externalAuth.address.toLowerCase() === msg.wallet.toLowerCase()) {
      wallet = externalAuth.address;
      signature = await externalAuth.signMessage(msg.message);
    } else if (!burnerIdentityAllowed()) {
      useGame.getState().pushLog("Error: Connect a wallet to sign in.");
      useGame.getState().setPhase("auth");
      markAuthInFlight(null);
      return;
    } else {
      const account = localAccount();
      if (account.address.toLowerCase() !== msg.wallet.toLowerCase()) {
        useGame.getState().pushLog("Error: Wallet mismatch on login challenge.");
        markAuthInFlight(null);
        return;
      }
      wallet = account.address;
      signature = await account.signMessage({ message: msg.message });
    }
    // Do not set authedWallet until auth/ok — signing alone is not a server session.
    socket.send(
      JSON.stringify({
        type: "auth",
        wallet,
        signature,
        nonce: msg.nonce,
        message: msg.message,
      } satisfies ClientMessage),
    );
  } catch {
    useGame.getState().pushLog("Error: Could not sign the login challenge.");
    useGame.getState().setPhase("auth");
    markAuthInFlight(null);
    authedWallet = null;
    allowSilentHello = false;
  }
}

/**
 * Connect home-chain wallet (Reown AppKit picker, or injected MetaMask without project id),
 * then re-auth as that wallet (replaces burner session). Login is sign-only — no forced switch.
 *
 * Never uses @walletconnect/ethereum-provider showQrModal (raw QR-only modal).
 */
export async function loginWithWalletConnect(opts?: {
  chainId?: number;
  rpcUrl?: string;
  /** When true, only adopt an already-connected AppKit account (Hud opened the modal). */
  appKitAlreadyOpen?: boolean;
  /** User clicked Connect — replace a stale session even if this wallet is already authed. */
  force?: boolean;
}): Promise<{ ok: true; address: string } | { ok: false; error: string }> {
  const chainId = opts?.chainId ?? Number(import.meta.env.VITE_CHAIN_ID ?? "100");
  const rpcUrl = opts?.rpcUrl ?? defaultRpcUrl(chainId);
  if (!Number.isSafeInteger(chainId) || chainId <= 0) {
    return { ok: false, error: "Bad VITE_CHAIN_ID for wallet login." };
  }
  try {
    let address: `0x${string}`;
    let signMessage: (message: string) => Promise<string>;

    if (appKitConfigured()) {
      const session = opts?.appKitAlreadyOpen
        ? await sessionFromConnectedAppKit()
        : await connectWithAppKit();
      address = session.address;
      signMessage = async (message) =>
        session.client.signMessage({ message, account: session.account });
      useGame.getState().pushLog("Wallet connected. Signing in…");
    } else if (injectedWalletAvailable()) {
      const session = await connectInjectedWallet({ chainId, rpcUrl, switchChain: false });
      address = session.address;
      signMessage = async (message) =>
        session.client.signMessage({ message, account: session.account });
      useGame.getState().pushLog("Browser wallet connected. Signing in…");
    } else {
      return {
        ok: false,
        error:
          "No wallet available. Set VITE_WALLETCONNECT_PROJECT_ID for Reown AppKit, or install MetaMask/Rabby.",
      };
    }

    skipRestoreUntilConnect = false;
    setPreferredPayoutWallet(address);
    const prevWallet = authedWallet ?? useGame.getState().wallet;
    if (shouldResetSessionOnWalletSwitch(prevWallet, address)) {
      dropGameSessionForWalletSwitch();
    }
    const force = !!opts?.force;
    const keepToken = force ? null : resumeTokenForWallet(address, resumeToken);
    if (!keepToken) resumeToken = null;
    else resumeToken = keepToken;
    externalAuth = { address, signMessage };
    saveAuthSession({
      wallet: address,
      resumeToken: keepToken,
    });
    if (!force) {
      if (isServerAuthed() && authedWallet === address.toLowerCase()) {
        return { ok: true, address };
      }
      if (authInFlight && authInFlightWallet === address.toLowerCase()) {
        return { ok: true, address };
      }
    }
    if (!force && resumeToken && resumeToken.length === 64) {
      if (socket?.readyState === WebSocket.OPEN) {
        beginAuthResume(address, resumeToken);
      } else {
        connectSocket();
      }
      return { ok: true, address };
    }
    authedWallet = null;
    markAuthInFlight(null);
    signOnNextOpen = true;
    if (socket?.readyState === WebSocket.OPEN) {
      signOnNextOpen = false;
      beginAuthHello(address, { force });
    } else {
      connectSocket();
    }
    return { ok: true, address };
  } catch (err) {
    if (isWalletDisconnectedError(err) || (err instanceof Error && err.message === WALLET_DISCONNECTED_HINT)) {
      return { ok: false, error: WALLET_DISCONNECTED_HINT };
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Connect is offered when AppKit (project id) or an injected wallet is available. */
export function walletConnectLoginAvailable(): boolean {
  return walletConnectConfigured() || injectedWalletAvailable();
}

/** @deprecated Use walletConnectLoginAvailable — includes injected fallback. */
export function walletLoginAvailable(): boolean {
  return walletConnectLoginAvailable();
}

/** True after the server has accepted signed auth (auth/ok). */
export function isServerAuthed(): boolean {
  return authedWallet !== null;
}

/** True while hello/resume or AppKit restore is in flight — Hud must not start a second hello. */
export function isAuthInFlight(): boolean {
  return authInFlight || restoreInFlight;
}

/** Ask the server whether a character name is free on the global log (before paying mint). */
export function checkCharacterNameAvailable(
  name: string,
): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return Promise.resolve({ ok: false, error: "Not connected to the server." });
  }
  if (!isServerAuthed()) {
    return Promise.resolve({ ok: false, error: "Sign in before checking names." });
  }
  if (nameCheckWaiter) {
    clearTimeout(nameCheckWaiter.timer);
    nameCheckWaiter.resolve({ ok: false, error: "Name check superseded." });
    nameCheckWaiter = null;
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (nameCheckWaiter?.resolve === resolve) nameCheckWaiter = null;
      resolve({ ok: false, error: "Name check timed out." });
    }, 8_000);
    nameCheckWaiter = { resolve, timer };
    socket!.send(JSON.stringify({ type: "char/nameCheck", name } satisfies ClientMessage));
  });
}

/**
 * Ask the server to reserve this ask price in the current epoch.
 * buyAsk is not broadcast when this refuses. Zero bonds refuse.
 */
export function requestEscrowFillAdmission(
  priceWei: string,
): Promise<{ ok: true; epoch: number } | { ok: false; error: string }> {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return Promise.resolve({ ok: false, error: "Not connected to the server." });
  }
  if (!isServerAuthed()) {
    return Promise.resolve({ ok: false, error: "Sign in before buying." });
  }
  const { req, done } = fillWaiters.open(8_000, () => ({ ok: false, error: "Epoch cap check timed out." }));
  socket.send(JSON.stringify({ type: "ah/admitFill", priceWei, req } satisfies ClientMessage));
  return done;
}

function epochFillRoundTrip(
  body: { type: "ah/pinFill"; priceWei: string; epoch: number; paidAtMs: number } | { type: "ah/releaseFill"; priceWei: string; epoch: number },
): Promise<void> {
  if (!socket || socket.readyState !== WebSocket.OPEN || !isServerAuthed()) return Promise.resolve();
  const { req, done } = fillWaiters.open(8_000, () => ({ ok: false, error: "timed out" }));
  socket.send(JSON.stringify({ ...body, req } satisfies ClientMessage));
  return done.then(() => undefined);
}

/** Keep a landed buyAsk in the epoch of its receipt. */
export function pinEscrowFillOnServer(priceWei: string, epoch: number, paidAtMs: number): Promise<void> {
  return epochFillRoundTrip({ type: "ah/pinFill", priceWei, epoch, paidAtMs });
}

/** Drop a reservation when buyAsk was not sent or reverted. */
export function releaseEscrowFillOnServer(priceWei: string, epoch: number): Promise<void> {
  return epochFillRoundTrip({ type: "ah/releaseFill", priceWei, epoch });
}

export async function clearExternalWalletAuth(): Promise<void> {
  skipRestoreUntilConnect = true;
  externalAuth = null;
  resumeToken = null;
  resumeAttempt = false;
  signOnNextOpen = false;
  allowSilentHello = false;
  clearAuthSession();
  await disconnectAppKit();
}

function bindVisibility() {
  if (visibilityBound || typeof document === "undefined") return;
  visibilityBound = true;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    if (!socket || socket.readyState === WebSocket.CLOSED || socket.readyState === WebSocket.CLOSING) {
      connectSocket();
      return;
    }
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "ping", t: Date.now() } satisfies ClientMessage));
    }
  });
}

export function connectSocket() {
  bindVisibility();
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return socket;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  rememberResume();
  const ws = new WebSocket(WS_URL);
  socket = ws;
  let opened = false;
  ws.addEventListener("open", () => {
    if (socket !== ws) return; // superseded by a newer socket
    opened = true;
    useGame.getState().setConnected(true);
    useGame.getState().pushLog("Connected to Black Anvil server.");
    startHeartbeat();
    tryAutoAuth();
  });
  ws.addEventListener("close", () => {
    // A stale socket closing late must not tear down the session of the newer one.
    if (socket !== ws) return;
    fillWaiters.settleAll(() => ({ ok: false, error: "Disconnected from the server." }));
    clearHeartbeat();
    useGame.getState().setConnected(false);
    authedWallet = null;
    markAuthInFlight(null);
    resumeAttempt = false;
    const wasLogout = intentionalLogout;
    intentionalLogout = false;
    if (!wasLogout) rememberResume();
    if (wasLogout) {
      useGame.getState().pushLog("Logged out.");
    } else if (!opened) {
      // Common when Vite bumped off 5173 and the server Origin allowlist rejected the upgrade.
      useGame.getState().pushLog(
        "Server refused the connection (is it running? Origin allowlist must include " +
          (typeof window !== "undefined" ? window.location.origin : "this page") +
          "). Retrying…",
      );
    } else {
      useGame.getState().pushLog("Disconnected. Reconnecting…");
    }
    reconnectTimer = setTimeout(connectSocket, wasLogout ? 0 : 1200);
  });
  ws.addEventListener("message", (ev) => {
    if (socket !== ws) return;
    let msg: ServerMessage;
    try {
      msg = JSON.parse(String(ev.data)) as ServerMessage;
    } catch {
      return; // malformed frame: drop it instead of throwing out of the handler
    }
    const g = useGame.getState();
    if (msg.type === "pong") {
      return;
    }
    if (msg.type === "auth/challenge") {
      void completeSignedAuth(msg);
      return;
    }
    if (msg.type === "auth/ok") {
      markAuthInFlight(null);
      resumeAttempt = false;
      if (msg.resumeToken) resumeToken = msg.resumeToken;
      saveAuthSession({
        wallet: msg.wallet as `0x${string}`,
        resumeToken: msg.resumeToken ?? resumeToken,
      });
      if (shouldKickLeftoverBurnerOnAuthOk(isStoredLocalBurnerWallet(msg.wallet))) {
        refuseLeftoverBurnerAndStayOnAuth();
        g.pushLog(
          "Connect the wallet that minted. The leftover local browser wallet cannot play on Gnosis.",
        );
        return;
      }
      authedWallet = msg.wallet.toLowerCase();
      g.setWallet(msg.wallet);
      if (shouldClearPendingCreateEnterOnAuthOk(g.pendingCreateEnter)) {
        g.setPendingCreateEnter(false);
      }
      const prevCharIds = g.characters.map((c) => c.id);
      const list =
        msg.characters?.length > 0
          ? msg.characters
          : msg.character
            ? [msg.character]
            : [];
      g.setCharacters(list);
      g.setHasCharacter(list.length > 0 || msg.hasCharacter);
      if ("characterMint" in msg) g.setCharacterMint(msg.characterMint ?? null);
      if (msg.replicaAllowlist && msg.replicaAllowlist.length > 0) {
        setReplicaAllowlist(msg.replicaAllowlist);
      }
      clearPendingMintIfTokenBound(
        msg.wallet,
        list.map((c) => c.tokenId),
      );
      const primary = msg.character ?? list[0] ?? null;
      g.setCharacterPreview(primary);

      const resumeId = consumeResumeId(list.map((c) => c.id));
      if (resumeId) {
        g.setPendingCreateEnter(false);
        g.setSelectedCharId(resumeId);
        g.setPhase("play");
        if (socket?.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify(characterEnterMessage(resumeId)));
        }
        return;
      }

      const createEnterId = createEnterIdAfterAuthOk(
        g.pendingCreateEnter,
        prevCharIds,
        list.map((c) => c.id),
      );
      if (createEnterId) {
        g.setSelectedCharId(createEnterId);
        g.setPhase("play");
        if (socket?.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify(characterEnterMessage(createEnterId)));
        }
        return;
      }

      if (shouldStayOnCreateAfterAuthOk(g.pendingCreateEnter, createEnterId)) {
        g.setPhase("create");
        if (shouldRequestOwnedNftSync({ rosterCount: list.length, hasMintConfig: !!msg.characterMint })) {
          send({ type: "char/syncOwned" });
        }
        return;
      }

      clearResumeStorage();
      g.clearSnapshot();
      g.setSelectedCharId(primary?.id ?? null);
      if (shouldRequestOwnedNftSync({ rosterCount: list.length, hasMintConfig: !!msg.characterMint })) {
        g.setPhase("select");
        send({ type: "char/syncOwned" });
        return;
      }
      g.setPhase(list.length > 0 || msg.hasCharacter ? "select" : "create");
    } else if (msg.type === "snapshot") {
      const applyHud = shouldApplyCreateSnapshotHud(g.phase, g.pendingCreateEnter);
      if (applyHud && g.phase === "play") {
        g.setSnapshot(msg);
        if (!intentionalLogout && msg.you.characterId) {
          try {
            localStorage.setItem(RESUME_KEY, msg.you.characterId);
          } catch {
            /* ignore */
          }
        }
        if (shouldClaimStarterOnSnapshot(g.pendingCreateEnter)) {
          send({ type: "claim/starter" });
        }
        if (g.pendingCreateEnter) {
          g.setPendingCreateEnter(false);
        }
        return;
      }
      const preview = {
        id: msg.you.characterId,
        name: msg.you.name,
        job: msg.you.job,
        level: msg.you.level,
        gender: msg.you.gender ?? "male",
        ...(msg.you.lok?.tokenId ? { tokenId: msg.you.lok.tokenId } : {}),
      };
      g.setHasCharacter(true);
      const others = g.characters.filter((c) => c.id !== preview.id);
      const nextRoster = [...others, preview];
      g.setCharacters(nextRoster);
      if (g.wallet) {
        clearPendingMintIfTokenBound(
          g.wallet,
          nextRoster.map((c) => c.tokenId),
        );
        // Successful create: roster updated — drop any pending paid mint for this wallet.
        if (g.pendingCreateEnter) clearPendingMint(g.wallet);
      }
      if (applyHud) {
        g.setCharacterPreview(preview);
        g.setSelectedCharId(preview.id);
        g.setSnapshot(msg);
        if (shouldClaimStarterOnSnapshot(g.pendingCreateEnter)) {
          send({ type: "claim/starter" });
          g.setPendingCreateEnter(false);
          g.setPhase("play");
        }
      }
    } else if (msg.type === "char/roster") {
      const list = msg.characters ?? [];
      g.setCharacters(list);
      g.setHasCharacter(list.length > 0 || msg.hasCharacter);
      if (g.wallet) {
        clearPendingMintIfTokenBound(
          g.wallet,
          list.map((c) => c.tokenId),
        );
      }
      const primary = list[0] ?? null;
      if (primary && !g.selectedCharId) {
        g.setSelectedCharId(primary.id);
        g.setCharacterPreview(primary);
      } else if (primary) {
        const selected = list.find((c) => c.id === g.selectedCharId) ?? primary;
        g.setCharacterPreview(selected);
      }
      const next = phaseAfterOwnedRoster({
        rosterCount: list.length,
        pendingCreateEnter: g.pendingCreateEnter,
        phase: g.phase,
      });
      if (next !== "keep") g.setPhase(next);
    } else if (msg.type === "char/nameCheck") {
      if (nameCheckWaiter) {
        clearTimeout(nameCheckWaiter.timer);
        const resolve = nameCheckWaiter.resolve;
        nameCheckWaiter = null;
        if (msg.available && msg.name) resolve({ ok: true, name: msg.name });
        else resolve({ ok: false, error: msg.error ?? "That name is not available." });
      }
    } else if (msg.type === "ah/admitFill") {
      fillWaiters.settle(
        msg.req,
        msg.ok && msg.epoch != null
          ? { ok: true, epoch: msg.epoch }
          : { ok: false, error: msg.error ?? "This epoch cannot take that ask." },
      );
    } else if (msg.type === "ah/pinFill" || msg.type === "ah/releaseFill") {
      fillWaiters.settle(msg.req, { ok: true, epoch: msg.type === "ah/pinFill" && msg.epoch != null ? msg.epoch : 0 });
    } else if (msg.type === "log") {
      // Immediate echo only — snapshot.log is the lasting combat log.
      g.pushLog(msg.message, { local: false });
    } else if (msg.type === "chat") {
      g.pushChat({
        channel: msg.channel,
        fromId: msg.fromId,
        fromName: msg.fromName,
        text: msg.text,
      });
    } else if (msg.type === "pvp/joined") {
      g.setPvpSlainPrompt(null);
    } else if (msg.type === "pvp/placeNeeded") {
      // Server asked for an on-chain place — pay then retry Join with the tx hash.
      void (async () => {
        const { placePvpBountyWithWallet } = await import("./pvp-place");
        g.pushLog("Wallet: place 1 xDAI head-bounty to enter Ash Pit…");
        const placed = await placePvpBountyWithWallet({
          escrow: {
            address: msg.address,
            bountyWei: msg.bountyWei,
            currency: "xDAI",
            synthetic: false,
            rpcUrl: msg.rpcUrl,
            chainId: msg.chainId,
          },
          tokenId: msg.tokenId,
        });
        if (!placed.ok) {
          g.pushLog(placed.error);
          return;
        }
        send({ type: "pvp/join", areaId: msg.areaId, placeTxHash: placed.hash });
      })();
    } else if (msg.type === "pvp/left") {
      g.setPvpSlainPrompt(null);
    } else if (msg.type === "pvp/slain") {
      g.setPvpSlainPrompt({
        slayerName: msg.slayerName,
        bountyWei: msg.bountyWei,
        areaId: msg.areaId,
      });
      /* Slain banner + server lastLog already record this. */
    } else if (msg.type === "error") {
      if (authInFlight && resumeAttempt) {
        markAuthInFlight(null);
        authedWallet = null;
        resumeAttempt = false;
        resumeToken = null;
        const dead = loadAuthSession()?.wallet;
        if (dead && isStoredLocalBurnerWallet(dead)) {
          clearAuthSession();
        } else {
          clearResumeTokenKeepWallet();
        }
        const live =
          externalAuth && !isStoredLocalBurnerWallet(externalAuth.address)
            ? externalAuth.address
            : null;
        if (live && shouldAllowSilentHello("resume-miss")) {
          allowSilentHello = true;
          beginAuthHello(live);
        } else {
          void waitRestoreExternalAuth().then((ok) => {
            if (
              ok &&
              externalAuth &&
              !isStoredLocalBurnerWallet(externalAuth.address) &&
              shouldAllowSilentHello("resume-miss")
            ) {
              allowSilentHello = true;
              beginAuthHello(externalAuth.address);
              return;
            }
            g.setPhase("auth");
          });
        }
      }
      // Only resolve a pending nameCheck on errors that are replies to that request path.
      if (
        nameCheckWaiter &&
        /Authenticate first|signed wallet first|Too many name checks/i.test(msg.message)
      ) {
        clearTimeout(nameCheckWaiter.timer);
        const resolve = nameCheckWaiter.resolve;
        nameCheckWaiter = null;
        resolve({ ok: false, error: msg.message });
      }
      // M-F: paid NFT already bound — stop reusing it on the next create.
      if (/already bound/i.test(msg.message) && g.wallet) {
        clearPendingMint(g.wallet);
      }
      g.pushLog(`Error: ${msg.message}`, { local: false });
    } else if (msg.type === "party/invite") {
      /* Party panel + server lastLog already record this. */
    } else if (msg.type === "lok/events") {
      g.setExplorer(msg);
    } else if (msg.type === "npc/dialog") {
      g.setNpcDialog({
        npcId: msg.npcId,
        title: msg.title,
        body: msg.body,
        jobs: msg.jobs,
        spells: msg.spells,
        subjobMode: msg.subjobMode,
        subLevel: msg.subLevel,
        craftOpen: msg.craftOpen,
        lokOpen: msg.lokOpen,
      });
    }
  });
  return ws;
}

/**
 * Leave the world: close the socket so the server parks the character,
 * forget the resume target, then reconnect onto character select (or create).
 */
export function logoutToMenu() {
  if (intentionalLogout) return;
  intentionalLogout = true;
  resumeCharId = null;
  clearResumeStorage();
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "auth/logout" } satisfies ClientMessage));
  }
  resumeToken = null;
  void clearExternalWalletAuth();
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  const g = useGame.getState();
  g.setPendingCreateEnter(false);
  g.setNpcDialog(null);
  g.clearSnapshot();
  g.setPhase(g.characters.length > 0 || g.hasCharacter ? "select" : "create");

  if (
    socket &&
    (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)
  ) {
    socket.close();
    return;
  }
  intentionalLogout = false;
  connectSocket();
}

const sendListeners = new Set<(msg: ClientMessage) => void>();

/** Observe outgoing messages (stick-web plays own-ability VFX from these). */
export function onSend(fn: (msg: ClientMessage) => void): () => void {
  sendListeners.add(fn);
  return () => {
    sendListeners.delete(fn);
  };
}

/** URL `?zone=forest_basin&x=128&z=28` rides along with char/enter so the server places the body. */
export function characterEnterMessage(characterId?: string): ClientMessage {
  const msg: ClientMessage = characterId
    ? { type: "char/enter", characterId }
    : { type: "char/enter" };
  if (typeof location === "undefined") return msg;
  const q = new URLSearchParams(location.search);
  const zone = q.get("zone");
  if (zone !== "forest_basin" && zone !== "pale_hollow" && zone !== "hollow_road") return msg;
  const x = Number(q.get("x"));
  const z = Number(q.get("z"));
  return {
    ...msg,
    zone,
    ...(Number.isFinite(x) ? { x } : {}),
    ...(Number.isFinite(z) ? { z } : {}),
  };
}

export function send(msg: ClientMessage) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    useGame.getState().pushLog("Not connected.");
    if (!socket || socket.readyState === WebSocket.CLOSED || socket.readyState === WebSocket.CLOSING) {
      connectSocket();
    }
    return;
  }
  socket.send(JSON.stringify(msg));
  for (const fn of sendListeners) fn(msg);
}

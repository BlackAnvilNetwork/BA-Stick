/** Hide the full-screen boot card once play starts — do not wait for the first snapshot. */
export function hideBootScreen(phase: string): boolean {
  return phase === "play";
}

/** NPC auto-open must not be treated as the next toggle-off. */
export function applyStayOpenToggle(
  open: boolean,
  stayOpen: boolean,
): { open: boolean; stayOpen: boolean } {
  if (stayOpen) return { open: true, stayOpen: false };
  return { open: !open, stayOpen: false };
}

export type PlayEscapeLayer =
  | "settings"
  | "commands"
  | "bag"
  | "craft"
  | "spellbook"
  | "party"
  | "skills"
  | "exchange"
  | "quest"
  | "explorer"
  | "ashPit"
  | "npc"
  | "disengage";

/** Topmost play overlay that should consume Escape before disengage. */
export function playEscapeLayer(open: {
  settings?: boolean;
  commands?: boolean;
  bag?: boolean;
  craft?: boolean;
  spellbook?: boolean;
  party?: boolean;
  skills?: boolean;
  exchange?: boolean;
  quest?: boolean;
  explorer?: boolean;
  ashPit?: boolean;
  npc?: boolean;
}): PlayEscapeLayer {
  if (open.settings) return "settings";
  if (open.commands) return "commands";
  if (open.bag) return "bag";
  if (open.craft) return "craft";
  if (open.spellbook) return "spellbook";
  if (open.party) return "party";
  if (open.skills) return "skills";
  if (open.exchange) return "exchange";
  if (open.quest) return "quest";
  if (open.explorer) return "explorer";
  if (open.ashPit) return "ashPit";
  if (open.npc) return "npc";
  return "disengage";
}

/** Create-mint timeout must not faucet+pay after Back / unmount. */
export function shouldRunCreateMint(formLeft: boolean): boolean {
  return !formLeft;
}

/** Logout / menu must drop play overlays; Hud stays mounted. */
export function shouldResetPlayOverlays(phase: string): boolean {
  return phase !== "play";
}

/** Wiki overlay is only for boot / auth / roster / create. */
export function shouldKeepBootWiki(phase: string): boolean {
  return phase === "boot" || phase === "auth" || phase === "select" || phase === "create";
}

/** User click always starts Connect — restore / an existing session must not swallow it. */
export function shouldAcceptWalletConnectClick(busy: boolean): boolean {
  return !busy;
}

/** Connected chip stays clickable so Account (switch / disconnect) is never locked. */
export function shouldDisableWalletControl(busy: boolean, connected: boolean): boolean {
  return busy && !connected;
}

/** Reown modal already shows Connect / Account — hide the boot chip while it is open. */
export function shouldHideWalletControlWhileModal(modalOpen: boolean): boolean {
  return modalOpen;
}

/** Gnosis C-1: omit mintWallet when it is the same as the signed-in session. */
export function shouldSendMintWallet(payer: string, gameWallet: string): boolean {
  return payer.toLowerCase() !== gameWallet.toLowerCase();
}

/** Pending unpaid-retry mint already reserved this name path — do not abort reuse. */
export function shouldSkipCreateNameCheck(hasPendingMint: boolean): boolean {
  return hasPendingMint;
}

export function createSubmitLabel(jobName: string, paidMint: boolean): string {
  return paidMint ? `Create ${jobName}` : `Create ${jobName} · Claim starter`;
}

export function truncateWalletLabel(address: string): string {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function walletControlLabel(opts: {
  busy: boolean;
  connected: boolean;
  address?: string | null;
}): string {
  if (opts.connected && opts.address) return truncateWalletLabel(opts.address);
  if (opts.busy) return "Opening wallet…";
  return "Connect Wallet";
}

/** Reown: Connect while disconnected, Account while connected. */
export function appKitModalView(isConnected: boolean): "Account" | "Connect" {
  return isConnected ? "Account" : "Connect";
}

/** After logout a warm AppKit chip must hello/resume, not open Account. */
export function shouldHelloOnConnectedWalletChip(opts: {
  serverAuthed: boolean;
  skipRestoreUntilConnect: boolean;
}): boolean {
  return opts.skipRestoreUntilConnect || !opts.serverAuthed;
}

/** Only a real click replaces an existing session. Auto-login must not force. */
export function shouldForceWalletLogin(userClicked: boolean): boolean {
  return userClicked;
}

export function shouldKickLeftoverBurnerToAuth(
  sessionWallet: string | null | undefined,
  leftover: boolean,
): boolean {
  return !!sessionWallet && leftover;
}

/**
 * AppKit reported a connected account. Login once per address from:
 * persisted same-address row, leftover-burner replace, unsigned live AppKit,
 * an Account-modal wallet switch, or an explicit click.
 * Never treat "address is not the burner" as persisted.
 */
export function shouldAutoLoginAppKit(opts: {
  connected: boolean;
  address?: string | null;
  persisted: boolean;
  userClicked: boolean;
  alreadyAuthed: boolean;
  startedFor?: string | null;
  authInFlight?: boolean;
  leftoverReplace?: boolean;
  unsignedLive?: boolean;
  accountSwitch?: boolean;
  skipRestoreUntilConnect?: boolean;
}): boolean {
  if (!opts.connected || !opts.address) return false;
  if (opts.skipRestoreUntilConnect && !opts.userClicked) return false;
  const addr = opts.address.toLowerCase();
  const replace = opts.userClicked || !!opts.accountSwitch;
  if (opts.startedFor && opts.startedFor.toLowerCase() === addr && !replace) {
    return false;
  }
  if (opts.alreadyAuthed && !replace) return false;
  if (opts.authInFlight && !replace) return false;
  return replace || opts.persisted || !!opts.leftoverReplace || !!opts.unsignedLive;
}

/**
 * Shared flags for mint / AH buy / EEZ sync-buy wallet sessions.
 * AppKit-only users (mobile WC, no extension) must never fall through to the burner.
 * On Gnosis/Chiado the burner is never a pay identity, even if AppKit is misconfigured.
 */
import { burnerIdentityAllowed } from "./burner-identity";

export function payWalletSessionOpts(opts: {
  hasInjected: boolean;
  appKitConfigured: boolean;
  /**
   * When false, never fall back to the localStorage burner for pay.
   * Defaults from Vite network (anvil only).
   */
  burnerAllowed?: boolean;
}): {
  allowBurnerFallback: boolean;
  preferWalletConnect: boolean;
} {
  const appKit = opts.appKitConfigured;
  const injected = opts.hasInjected;
  const burnerOk = opts.burnerAllowed ?? burnerIdentityAllowed();
  return {
    // Burner only on anvil when there is no injected wallet AND no AppKit project id.
    allowBurnerFallback: burnerOk && !injected && !appKit,
    // Open / reuse AppKit when configured and no browser extension.
    preferWalletConnect: appKit && !injected,
  };
}

export function hasInjectedWallet(): boolean {
  if (typeof window === "undefined") return false;
  const eth = (window as unknown as { ethereum?: { request?: unknown } }).ethereum;
  return !!eth && typeof eth.request === "function";
}

export { burnerIdentityAllowed };

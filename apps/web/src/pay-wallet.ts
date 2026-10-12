/**
 * Shared flags for mint / AH buy / EEZ sync-buy wallet sessions.
 * AppKit-only users (mobile WC, no extension) must never fall through to the burner.
 */
export function payWalletSessionOpts(opts: {
  hasInjected: boolean;
  appKitConfigured: boolean;
}): {
  allowBurnerFallback: boolean;
  preferWalletConnect: boolean;
} {
  const appKit = opts.appKitConfigured;
  const injected = opts.hasInjected;
  return {
    // Burner only when there is no injected wallet AND no AppKit project id.
    allowBurnerFallback: !injected && !appKit,
    // Open / reuse AppKit when configured and no browser extension.
    preferWalletConnect: appKit && !injected,
  };
}

export function hasInjectedWallet(): boolean {
  if (typeof window === "undefined") return false;
  const eth = (window as unknown as { ethereum?: { request?: unknown } }).ethereum;
  return !!eth && typeof eth.request === "function";
}

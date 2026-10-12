/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WS_URL?: string;
  /** WalletConnect Cloud project id — enables the Connect Wallet button. */
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string;
  /** Public RPC for WalletConnect / pay flows (e.g. Robinhood mainnet). */
  readonly VITE_RPC_URL?: string;
  /** Anvil RPC on the dev machine (defaults to 127.0.0.1:8545). */
  readonly VITE_ANVIL_RPC_URL?: string;
  /** Reachable anvil RPC for mobile WalletConnect (LAN IP, ngrok, etc.). */
  readonly VITE_ANVIL_PUBLIC_RPC_URL?: string;
  /** Target chain id (default 4663 Robinhood). Use 31337 for local preview mint pay. */
  readonly VITE_CHAIN_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WS_URL?: string;
  /** WalletConnect Cloud project id — enables the Connect Wallet button. */
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string;
  /** Public RPC for WalletConnect / pay flows (e.g. Robinhood mainnet). */
  readonly VITE_RPC_URL?: string;
  /** Target chain id (default 4663 Robinhood). */
  readonly VITE_CHAIN_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

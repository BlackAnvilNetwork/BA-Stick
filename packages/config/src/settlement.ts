/**
 * Native settlement currency per chain. Mint fee, AH ask prices, and the 1%
 * marketplace fee are always `msg.value` in this native unit (no WETH wrap).
 *
 * - Gnosis mainnet (100) / Chiado (10200): **xDAI** (dollar-ish)
 * - Local anvil (31337): **ETH**
 * Switch to ETH-via-EEZ later by pointing at an ETH-native settlement chain —
 * contracts stay native-value; only this table + UI labels change.
 */

export type SettlementCurrency = {
  chainId: number;
  /** Short UI label ("xDAI", "ETH"). */
  symbol: string;
  /** Wallet / add-chain name. */
  name: string;
  decimals: number;
  /**
   * Default CharacterFactory mintFee in wei (native).
   * Gnosis: 1 xDAI (~$1) — flagged for product tuning in docs/mainnet-plan.md.
   * Anvil: 0.001 ETH (existing local default).
   */
  defaultMintFeeWei: bigint;
  /** Example human ask price for placeholders (e.g. "1" → 1 xDAI). */
  exampleAskHuman: string;
};

const ONE = 10n ** 18n;

export const SETTLEMENT_BY_CHAIN: Record<number, SettlementCurrency> = {
  /** Gnosis Chain mainnet */
  100: {
    chainId: 100,
    symbol: "xDAI",
    name: "xDAI",
    decimals: 18,
    defaultMintFeeWei: ONE, // 1 xDAI — product may tune
    exampleAskHuman: "1",
  },
  /** Gnosis Chiado testnet (EEZ L1 for public rollup0) */
  10200: {
    chainId: 10200,
    symbol: "xDAI",
    name: "Chiado xDAI",
    decimals: 18,
    defaultMintFeeWei: ONE,
    exampleAskHuman: "1",
  },
  /** Local anvil */
  31337: {
    chainId: 31337,
    symbol: "ETH",
    name: "Ether",
    decimals: 18,
    defaultMintFeeWei: 10n ** 15n, // 0.001 ETH
    exampleAskHuman: "0.001",
  },
};

export function isSettlementChain(chainId: number): boolean {
  return Object.prototype.hasOwnProperty.call(SETTLEMENT_BY_CHAIN, chainId);
}

/** Resolve currency for a chain; unknown chains fall back to ETH-shaped defaults. */
export function settlementCurrency(chainId: number): SettlementCurrency {
  return (
    SETTLEMENT_BY_CHAIN[chainId] ?? {
      chainId,
      symbol: "ETH",
      name: "Ether",
      decimals: 18,
      defaultMintFeeWei: 10n ** 15n,
      exampleAskHuman: "0.001",
    }
  );
}

/** JSON-safe view for snapshots / client config. */
export function settlementCurrencyView(chainId: number): {
  chainId: number;
  symbol: string;
  name: string;
  decimals: number;
  defaultMintFeeWei: string;
  exampleAskHuman: string;
} {
  const c = settlementCurrency(chainId);
  return {
    chainId: c.chainId,
    symbol: c.symbol,
    name: c.name,
    decimals: c.decimals,
    defaultMintFeeWei: c.defaultMintFeeWei.toString(),
    exampleAskHuman: c.exampleAskHuman,
  };
}

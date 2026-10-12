import { settlementCurrency } from "@bellgrave/config";
import type { SettlementCurrencyView } from "@bellgrave/protocol";

/** Native settlement unit label from snapshot currency or chain id (xDAI / ETH). */
export function settlementSymbol(
  currency?: SettlementCurrencyView | null,
  chainId?: number | null,
): string {
  if (currency?.symbol) return currency.symbol;
  if (chainId != null && Number.isFinite(chainId)) return settlementCurrency(chainId).symbol;
  return "ETH";
}

export function settlementExampleAsk(
  currency?: SettlementCurrencyView | null,
  chainId?: number | null,
): string {
  if (currency?.exampleAskHuman) return currency.exampleAskHuman;
  if (chainId != null && Number.isFinite(chainId)) return settlementCurrency(chainId).exampleAskHuman;
  return "0.001";
}

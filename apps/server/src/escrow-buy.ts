/**
 * buyAsk moves the ask price in xDAI. That transfer is not broadcast until
 * this epoch admits it. Zero posted bonds admit nothing. A price that would
 * put the epoch over 10% of the slashable bonds posted now is not sent.
 */
import { admitEscrowFill, pinEpochCharge, releaseEpochXdai } from "./root-anchor";

export async function chainBuyAsk(opts: {
  priceWei: bigint;
  /** Resolves when the transfer is broadcast. `paidAtMs` is the receipt block time. */
  broadcast: () => Promise<void | { paidAtMs?: number }>;
}): Promise<{ ok: true; epoch: number } | { ok: false; error: string }> {
  if (opts.priceWei <= 0n) return { ok: false, error: "Ask price must be greater than 0." };
  const admitted = admitEscrowFill(opts.priceWei);
  if (!admitted.ok) return admitted;
  try {
    const landed = await opts.broadcast();
    const paidAtMs = landed && typeof landed === "object" ? landed.paidAtMs : undefined;
    if (paidAtMs == null) return { ok: true, epoch: admitted.epoch };
    const epoch = pinEpochCharge(opts.priceWei, admitted.epoch, paidAtMs, "buy:" + admitted.epoch + ":" + opts.priceWei.toString() + ":" + paidAtMs);
    return { ok: true, epoch };
  } catch (err) {
    releaseEpochXdai(opts.priceWei, admitted.epoch);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

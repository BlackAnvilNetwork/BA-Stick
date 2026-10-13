/** Per-token and per-player locks for gold spends (trainer, craft, respec). Not a mint. */

const tails = new Map<string, Promise<void>>();
const playerTails = new Map<string, Promise<void>>();

export function withKekLock<T>(token: string, fn: () => Promise<T>): Promise<T> {
  const prev = tails.get(token) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  tails.set(
    token,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run;
}

/** One craft or trainer buy at a time for this character. The lock covers the check and the spend. */
export function withPlayerAction<T>(playerId: string, fn: () => Promise<T>): Promise<T> {
  const prev = playerTails.get(playerId) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  playerTails.set(
    playerId,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run;
}

/**
 * Serialize a gold spend and the grant that follows it.
 * A second overlapping call waits, re-checks, and does not spend when the first already took the cost.
 */
export async function withPlayerCharge(
  playerId: string,
  stillOk: () => boolean,
  reserve: () => (() => void) | null,
  spend: () => Promise<{ ok: true } | { ok: false; error: string }>,
  grant: () => void,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return withPlayerAction(playerId, async () => {
    if (!stillOk()) return { ok: false, error: "no longer available" };
    const undo = reserve();
    if (!undo) return { ok: false, error: "no longer available" };
    const paid = await spend();
    if (!paid.ok) {
      undo();
      return paid;
    }
    grant();
    return { ok: true };
  });
}

/** Serialize spends against one character token (gold sinks share this lock). */
export function guardedKekMove<T>(token: string, fn: () => T | Promise<T>): Promise<T> {
  return withKekLock(token, async () => await fn());
}

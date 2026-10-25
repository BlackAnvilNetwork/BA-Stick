// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

/**
 * Pending request/reply waiters keyed by `req`. Each request owns its own slot,
 * so a later request (e.g. an ah/pinFill) never orphans an earlier one
 * (e.g. an ah/admitFill still waiting on the server).
 */
export class ReqWaiters<T> {
  private next = 0;
  private readonly waiting = new Map<number, { resolve: (v: T) => void; timer: ReturnType<typeof setTimeout> }>();

  /** Start a request: returns its id and a promise settled by `settle` or by `onTimeout` after `ms`. */
  open(ms: number, onTimeout: () => T): { req: number; done: Promise<T> } {
    const req = ++this.next;
    const done = new Promise<T>((resolve) => {
      const timer = setTimeout(() => {
        this.waiting.delete(req);
        resolve(onTimeout());
      }, ms);
      this.waiting.set(req, { resolve, timer });
    });
    return { req, done };
  }

  /** Resolve the waiter for `req`; false when none is pending (late or unknown reply). */
  settle(req: number, value: T): boolean {
    const w = this.waiting.get(req);
    if (!w) return false;
    clearTimeout(w.timer);
    this.waiting.delete(req);
    w.resolve(value);
    return true;
  }

  /** Resolve every pending waiter with `value(req)` (e.g. on disconnect). */
  settleAll(value: () => T): void {
    for (const req of [...this.waiting.keys()]) this.settle(req, value());
  }

  get size(): number {
    return this.waiting.size;
  }
}

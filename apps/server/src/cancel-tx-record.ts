/**
 * Record LISTING cancelAsk broadcasts so a timed-out finality wait can be
 * distinguished from an AskFilled on retry (re-test MED #2).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { durableWrite } from "./durable-write";
import { defaultLokDir } from "./lok-world";

export const CANCEL_TX_RECORD_FILE = "cancel-ask-txs.json";

export type CancelTxRecord = {
  listingId: string;
  hash: string;
  at: string;
};

type FileShape = { cancels: Record<string, CancelTxRecord> };

export function cancelTxRecordPath(dataDir: string = defaultLokDir()): string {
  return join(dataDir, CANCEL_TX_RECORD_FILE);
}

export class CancelTxRecordStore {
  private cancels: Record<string, CancelTxRecord> = {};

  constructor(readonly path: string) {
    this.reload();
  }

  reload(): void {
    if (!existsSync(this.path)) {
      this.cancels = {};
      return;
    }
    const raw = readFileSync(this.path, "utf8");
    let parsed: FileShape;
    try {
      parsed = JSON.parse(raw) as FileShape;
    } catch (err) {
      throw new Error(
        `Corrupt cancel-ask-txs.json at ${this.path} — refusing to start with potentially lost cancel state. ` +
          `Fix or remove the file manually. Parse error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    this.cancels =
      parsed.cancels && typeof parsed.cancels === "object" ? parsed.cancels : {};
  }

  private persist(): void {
    durableWrite(this.path, JSON.stringify({ cancels: this.cancels } satisfies FileShape, null, 2) + "\n");
  }

  get(listingId: string): CancelTxRecord | null {
    return this.cancels[listingId] ?? null;
  }

  set(listingId: string, hash: string): void {
    if (!/^[1-9][0-9]{0,77}$/.test(listingId)) return;
    this.cancels[listingId] = {
      listingId,
      hash,
      at: new Date().toISOString(),
    };
    this.persist();
  }

  clear(listingId: string): void {
    if (!this.cancels[listingId]) return;
    delete this.cancels[listingId];
    this.persist();
  }
}

let shared: CancelTxRecordStore | null = null;

export function cancelTxRecordStore(dataDir?: string): CancelTxRecordStore {
  if (!shared || (dataDir && shared.path !== cancelTxRecordPath(dataDir))) {
    shared = new CancelTxRecordStore(cancelTxRecordPath(dataDir));
  }
  return shared;
}

export function resetCancelTxRecordForTests(): void {
  shared = null;
}

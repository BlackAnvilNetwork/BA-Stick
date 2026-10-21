/**
 * Re-process one quarantined AskFilled (see src/lok-ask-filled-quarantine.ts).
 *
 * Usage (server stopped):
 *   pnpm --filter @bellgrave/server lok:replay-ask-filled --list
 *   pnpm --filter @bellgrave/server lok:replay-ask-filled <id> [dataDir]
 */
import { applyAskFilled } from "../src/ah-escrow";
import { dataDirLockedByOther } from "../src/data-dir-lock";
import {
  AskFilledQuarantine,
  MirroredFills,
  askFilledMirroredPath,
  askFilledQuarantinePath,
  loadAskFilledQuarantine,
} from "../src/lok-ask-filled-quarantine";
import { defaultLokDir, LokWorld } from "../src/lok-world";

const id = process.argv[2]?.trim() ?? "";
const dataDir = process.argv[3]?.trim() || defaultLokDir();

if (!id || id === "--list") {
  const entries = loadAskFilledQuarantine(askFilledQuarantinePath(dataDir));
  if (entries.length === 0) console.log("No quarantined AskFilled fills in " + dataDir + ".");
  for (const e of entries) {
    console.log(
      e.id +
        "  " +
        e.reason +
        "  listing=" +
        e.fill.listingId +
        " buyerToken=" +
        e.fill.buyerTokenId +
        " price=" +
        e.fill.priceWei +
        "  " +
        e.error,
    );
  }
  if (!id) console.error("Pass an id to replay it.");
  process.exit(id ? 0 : 1);
}

const holder = dataDirLockedByOther(dataDir);
if (holder) {
  console.error(
    "A server (pid " + holder.pid + ", since " + holder.startedAt + ") has this data dir open. Stop it first. Nothing was replayed.",
  );
  process.exit(1);
}

const quarantine = new AskFilledQuarantine(askFilledQuarantinePath(dataDir));
const entry = quarantine.list().find((row) => row.id === id);
if (!entry) {
  console.error("No quarantined AskFilled with id " + id + ". Nothing was replayed.");
  process.exit(1);
}

const lok = LokWorld.open(dataDir);
const mirrored = new MirroredFills(askFilledMirroredPath(dataDir));
const res = applyAskFilled(lok, entry.fill, entry.id, {
  mirrored,
  log: {
    transactionHash: entry.transactionHash,
    logIndex: entry.logIndex,
    blockNumber: entry.blockNumber,
  },
});
if (!res.ok) {
  console.error("Replay refused " + id + ": " + res.error + " (" + res.kind + "). Entry kept.");
  process.exit(1);
}
if (res.kind === "applied") quarantine.remove(id);
console.log("Replayed AskFilled " + id + " (" + res.kind + ").");
process.exit(0);

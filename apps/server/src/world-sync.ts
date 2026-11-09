/**
 * World sync is one state, recomputed from the journal and the chain.
 * It is not written to disk. An empty directory is not genesis unless this
 * boot says so. A stored flag is how a second world starts.
 *
 * Boot and runtime share the state. Policy decides what they do with it:
 * boot exits on refused and missing-history. After listen, missing-history
 * stays up and refuses logins and appends.
 */
import { NO_WORLD_COPY } from "./world-identity";

export type SyncReason =
  | "identity-unconfigured"
  | "wrong-contract"
  | "empty-directory"
  | "missing-mint"
  | "forked-root";

export type WorldSync =
  | { state: "refused"; reason: SyncReason; detail: string }
  | { state: "genesis" }
  | { state: "identified" }
  | { state: "missing-history"; tokenIds: string[] }
  | { state: "not-synced"; detail: string }
  | { state: "behind-tail"; localHead: string; publishedHead: string };

export type SyncEvent =
  | { type: "boot-invalid-config"; detail: string }
  | { type: "boot-identity-mismatch"; detail: string }
  | { type: "boot-empty"; chainWorldExists: boolean; manifestPublished: boolean }
  | { type: "boot-journal" }
  | { type: "mint-pending" }
  | { type: "mint-hole"; tokenIds: string[] }
  | { type: "manifest-empty"; detail: string }
  | { type: "tail-behind"; localHead: string; publishedHead: string }
  | { type: "tail-caught-up" }
  | { type: "forked-root"; detail: string };

export const SYNC_START: WorldSync = {
  state: "refused",
  reason: "identity-unconfigured",
  detail: "boot has not run",
};

export function syncLabel(sync: WorldSync): string {
  switch (sync.state) {
    case "refused":
      return "refused:" + sync.reason;
    case "missing-history":
      return "missing-history:" + sync.tokenIds.join(",");
    case "behind-tail":
      return "behind-tail";
    case "not-synced":
      return "not-synced";
    case "genesis":
      return "genesis";
    case "identified":
      return "identified";
    default: {
      const _exhaustive: never = sync;
      return _exhaustive;
    }
  }
}

/** One transition. Illegal events leave the state unchanged. */
export function reduceWorldSync(state: WorldSync, event: SyncEvent): WorldSync {
  switch (event.type) {
    case "boot-invalid-config":
      return { state: "refused", reason: "identity-unconfigured", detail: event.detail };
    case "boot-identity-mismatch":
      return { state: "refused", reason: "wrong-contract", detail: event.detail };
    case "boot-empty":
      if (event.manifestPublished) {
        return { state: "not-synced", detail: "A manifest is published and this directory has no journal." };
      }
      if (event.chainWorldExists) {
        return { state: "refused", reason: "empty-directory", detail: NO_WORLD_COPY };
      }
      return { state: "genesis" };
    case "boot-journal":
      // The start sentinel is identity-unconfigured. A real refusal stays refused.
      if (state.state === "refused" && state.reason !== "identity-unconfigured") return state;
      return { state: "identified" };
    case "mint-pending":
      if (state.state === "identified" || state.state === "genesis") return state;
      return state;
    case "mint-hole":
      if (state.state === "refused" || state.state === "not-synced") return state;
      return { state: "missing-history", tokenIds: [...event.tokenIds] };
    case "manifest-empty":
      if (state.state === "identified" || state.state === "genesis" || state.state === "behind-tail") return state;
      return { state: "not-synced", detail: event.detail };
    case "tail-behind":
      if (state.state !== "identified" && state.state !== "genesis" && state.state !== "behind-tail") return state;
      return { state: "behind-tail", localHead: event.localHead, publishedHead: event.publishedHead };
    case "tail-caught-up":
      if (state.state !== "behind-tail") return state;
      return { state: "identified" };
    case "forked-root":
      if (state.state === "refused" || state.state === "not-synced") return state;
      return { state: "refused", reason: "forked-root", detail: event.detail };
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}

/** Boot exits on these. The same missing-history state does not exit after listen. */
export function syncBootExit(sync: WorldSync): string | null {
  if (sync.state === "refused") return sync.detail;
  if (sync.state === "missing-history") return NO_WORLD_COPY;
  return null;
}

let current: WorldSync = SYNC_START;

export function currentWorldSync(): WorldSync {
  return current;
}

/** Apply one event and log the transition on a single line. Nothing is written to disk. */
export function applyWorldSync(event: SyncEvent): WorldSync {
  const next = reduceWorldSync(current, event);
  if (syncLabel(current) !== syncLabel(next)) {
    console.error("[world-sync] " + syncLabel(current) + " -> " + syncLabel(next) + " event=" + event.type);
  }
  current = next;
  return current;
}

export function resetWorldSyncForTests(state: WorldSync = SYNC_START): void {
  current = state;
}

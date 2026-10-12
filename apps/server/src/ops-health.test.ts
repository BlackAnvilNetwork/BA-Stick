import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { IncomingMessage, ServerResponse } from "node:http";
import { ASK_FILLED_QUARANTINE_FILE } from "./lok-ask-filled-quarantine";
import { NFT_TRANSFER_DROPPED_FILE } from "./nft-transfer-ask-cancel";
import { buildOpsStatus, handleOpsHttp } from "./ops-health";
import { opsAlert, resetOpsAlertsForTests, watcherLagAlertBlocks } from "./ops-log";

describe("ops health + structured alerts", () => {
  it("watcherLagAlertBlocks defaults to 50 and reads LOK_WATCHER_LAG_ALERT_BLOCKS", () => {
    assert.equal(watcherLagAlertBlocks({}), 50n);
    assert.equal(watcherLagAlertBlocks({ LOK_WATCHER_LAG_ALERT_BLOCKS: "12" }), 12n);
  });

  it("opsAlert writes JSON ring and dedupes lag keys", () => {
    resetOpsAlertsForTests();
    opsAlert({
      level: "alert",
      event: "watcher_lag",
      msg: "lag",
      watcher: "askFilled",
      dedupeKey: "lag:askFilled:99",
    });
    opsAlert({
      level: "alert",
      event: "watcher_lag",
      msg: "lag",
      watcher: "askFilled",
      dedupeKey: "lag:askFilled:99",
    });
    const status = buildOpsStatus({
      lokReady: () => true,
      startedAtMs: Date.now() - 5000,
      dataDir: mkdtempSync(join(tmpdir(), "lok-ops-")),
      env: { NETWORK: "gnosis", LOK_CHAIN_ID: "100" },
    });
    assert.equal(status.ready, true);
    assert.equal(status.network, "gnosis");
    assert.equal(status.alerts.recent.length, 1);
    assert.equal(status.alerts.recent[0]!.event, "watcher_lag");
  });

  it("buildOpsStatus counts dropped cancels and quarantine files", () => {
    resetOpsAlertsForTests();
    const dir = mkdtempSync(join(tmpdir(), "lok-ops-"));
    writeFileSync(
      join(dir, NFT_TRANSFER_DROPPED_FILE),
      JSON.stringify({
        dropped: [{ listingId: "1", sellerTokenId: "2", attempts: 9, droppedAt: "x", reason: "max-attempts" }],
      }),
    );
    writeFileSync(
      join(dir, ASK_FILLED_QUARANTINE_FILE),
      JSON.stringify({
        entries: [
          {
            id: "0x1-0",
            reason: "unknown-listing",
            error: "x",
            fill: {
              listingId: "1",
              buyer: "0x1",
              buyerTokenId: "2",
              sellerPayout: "0x3",
              priceWei: "1",
              feeWei: "0",
              itemId: "1",
              amount: "1",
            },
            blockNumber: "1",
            logIndex: "0",
            transactionHash: "0x" + "ab".repeat(32),
            quarantinedAt: "x",
          },
        ],
      }),
    );
    const status = buildOpsStatus({
      lokReady: () => true,
      startedAtMs: Date.now(),
      dataDir: dir,
      env: { NETWORK: "gnosis" },
    });
    assert.equal(status.alerts.droppedCancels, 1);
    assert.equal(status.alerts.askFilledQuarantine, 1);
  });

  it("handleOpsHttp serves /health /ready /status", async () => {
    resetOpsAlertsForTests();
    const dir = mkdtempSync(join(tmpdir(), "lok-ops-"));
    const deps = {
      lokReady: () => true,
      startedAtMs: Date.now(),
      dataDir: dir,
      env: { NETWORK: "anvil", LOK_CHAIN_ID: "31337" },
    };

    async function hit(path: string): Promise<{ status: number; body: string }> {
      return new Promise((resolve) => {
        let status = 0;
        let body = "";
        const res = {
          writeHead(code: number) {
            status = code;
          },
          end(chunk?: string) {
            body = chunk ?? "";
            resolve({ status, body });
          },
        } as unknown as ServerResponse;
        const req = { url: path, headers: { host: "localhost" } } as IncomingMessage;
        assert.equal(handleOpsHttp(req, res, deps), true);
      });
    }

    const health = await hit("/health");
    assert.equal(health.status, 200);
    assert.equal(JSON.parse(health.body).ok, true);

    const ready = await hit("/ready");
    assert.equal(ready.status, 200);

    const status = await hit("/status");
    assert.equal(status.status, 200);
    const parsed = JSON.parse(status.body);
    assert.equal(parsed.network, "anvil");
    assert.equal(parsed.ready, true);
  });
});

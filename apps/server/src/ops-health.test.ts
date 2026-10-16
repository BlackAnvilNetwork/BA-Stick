import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import type { IncomingMessage, ServerResponse } from "node:http";
import { ASK_FILLED_QUARANTINE_FILE } from "./lok-ask-filled-quarantine";
import { NFT_TRANSFER_DROPPED_FILE } from "./nft-transfer-ask-cancel";
import {
  buildOpsStatus,
  handleOpsHttp,
  isProductionOpsEnv,
  redactSettlementRpcStats,
  statusAuthorized,
} from "./ops-health";
import { opsAlert, resetOpsAlertsForTests, watcherLagAlertBlocks } from "./ops-log";
import { jsonStringifySafe, redactDataDir, redactRpcUrl } from "./ops-redact";
import {
  resetSettlementRpcForTests,
  RotatingJsonRpc,
  setSettlementRpcForTests,
} from "./settlement-rpc";

describe("ops health + structured alerts", () => {
  afterEach(() => {
    resetOpsAlertsForTests();
    resetSettlementRpcForTests();
  });

  it("watcherLagAlertBlocks defaults to 50 and reads LOK_WATCHER_LAG_ALERT_BLOCKS", () => {
    assert.equal(watcherLagAlertBlocks({}), 50n);
    assert.equal(watcherLagAlertBlocks({ LOK_WATCHER_LAG_ALERT_BLOCKS: "12" }), 12n);
  });

  it("redacts RPC URLs to scheme+host", () => {
    assert.equal(
      redactRpcUrl("https://eth-mainnet.g.alchemy.com/v2/SECRET_KEY_HERE"),
      "https://eth-mainnet.g.alchemy.com",
    );
    assert.equal(redactDataDir("/var/lib/bellgrave/prod-data"), "prod-data");
  });

  it("jsonStringifySafe serializes BigInt without throwing", () => {
    const s = jsonStringifySafe({ tip: 42n, nested: { c: 7n } });
    assert.equal(JSON.parse(s).tip, "42");
    assert.equal(JSON.parse(s).nested.c, "7");
  });

  it("opsAlert writes JSON ring and dedupes lag keys", () => {
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

  it("/status serializes populated tipBlock + cursors (BigInt) without crashing", async () => {
    const client = new RotatingJsonRpc([
      "https://eth-mainnet.g.alchemy.com/v2/SUPER_SECRET_KEY",
      "https://rpc.gnosischain.com",
    ]);
    client.stats.tipBlock = 12_345_678n;
    client.noteCursor("askFilled", 12_345_600n);
    client.noteCursor("nftTransfer", 12_345_550n);
    client.stats.lastError = "HTTP 429 from https://eth-mainnet.g.alchemy.com/v2/SUPER_SECRET_KEY";
    setSettlementRpcForTests(client);

    const dir = mkdtempSync(join(tmpdir(), "lok-ops-"));
    const deps = {
      lokReady: () => true,
      startedAtMs: Date.now(),
      dataDir: join(dir, "absolute-secret-path"),
      env: {
        NETWORK: "gnosis",
        LOK_CHAIN_ID: "100",
        LOK_OPS_STATUS_TOKEN: "bigint-test-token",
      },
      remoteAddress: "203.0.113.9",
    };
    // basename of a path that may not exist yet — create it
    const { mkdirSync } = await import("node:fs");
    mkdirSync(deps.dataDir, { recursive: true });

    const view = redactSettlementRpcStats(client.stats);
    assert.ok(view);
    assert.equal(view.url, "https://eth-mainnet.g.alchemy.com");
    assert.ok(!view.urls.some((u) => u.includes("SECRET")));
    assert.ok(!view.lastError?.includes("SECRET"));
    assert.equal(view.tipBlock, "12345678");
    assert.equal(view.cursors.askFilled, "12345600");

    let status = 0;
    let body = "";
    const res = {
      writeHead(code: number) {
        status = code;
      },
      end(chunk?: string) {
        body = chunk ?? "";
      },
    } as unknown as ServerResponse;
    const req = {
      url: "/status",
      headers: {
        host: "game.example",
        authorization: "Bearer bigint-test-token",
      },
      socket: { remoteAddress: "203.0.113.9" },
    } as unknown as IncomingMessage;

    assert.equal(handleOpsHttp(req, res, deps), true);
    assert.equal(status, 200);
    // Must not throw / must parse — this is the HIGH repro.
    const parsed = JSON.parse(body);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.rpc.tipBlock, "12345678");
    assert.equal(parsed.rpc.cursors.askFilled, "12345600");
    assert.equal(parsed.rpc.url, "https://eth-mainnet.g.alchemy.com");
    assert.ok(!JSON.stringify(parsed).includes("SECRET"));
    assert.equal(parsed.dataDir, "absolute-secret-path");
  });

  it("/status rejects Host: localhost spoof; production requires bearer token", async () => {
    const dir = mkdtempSync(join(tmpdir(), "lok-ops-"));

    // Spoofed Host must not authorize a remote socket.
    const spoofReq = {
      headers: { host: "localhost:8787" },
      socket: { remoteAddress: "203.0.113.9" },
    } as unknown as IncomingMessage;
    assert.equal(
      statusAuthorized(spoofReq, { NETWORK: "anvil", LOK_CHAIN_ID: "31337" }, "203.0.113.9"),
      false,
    );

    // Production without token: deny even loopback (proxy would look local).
    assert.equal(
      statusAuthorized(
        { headers: {}, socket: { remoteAddress: "127.0.0.1" } } as IncomingMessage,
        { NETWORK: "gnosis", LOK_CHAIN_ID: "100" },
        "127.0.0.1",
      ),
      false,
    );

    // Chiado is production for ops auth (no loopback bypass).
    assert.equal(isProductionOpsEnv({ NETWORK: "chiado", LOK_CHAIN_ID: "10200" }), true);
    assert.equal(
      statusAuthorized(
        { headers: {}, socket: { remoteAddress: "127.0.0.1" } } as IncomingMessage,
        { NETWORK: "chiado", LOK_CHAIN_ID: "10200" },
        "127.0.0.1",
      ),
      false,
    );
    assert.equal(
      statusAuthorized(
        {
          headers: { authorization: "Bearer chiado-token" },
          socket: { remoteAddress: "127.0.0.1" },
        } as IncomingMessage,
        { NETWORK: "chiado", LOK_CHAIN_ID: "10200", LOK_OPS_STATUS_TOKEN: "chiado-token" },
        "127.0.0.1",
      ),
      true,
    );

    const env = {
      NETWORK: "gnosis",
      LOK_CHAIN_ID: "100",
      LOK_OPS_STATUS_TOKEN: "test-token",
    };
    const deps = {
      lokReady: () => true,
      startedAtMs: Date.now(),
      dataDir: dir,
      env,
      remoteAddress: "203.0.113.9",
    };

    async function hit(
      headers: Record<string, string>,
      remote = "203.0.113.9",
    ): Promise<{ status: number; body: string }> {
      return new Promise((resolve) => {
        let statusCode = 0;
        let body = "";
        const res = {
          writeHead(code: number) {
            statusCode = code;
          },
          end(chunk?: string) {
            body = chunk ?? "";
            resolve({ status: statusCode, body });
          },
        } as unknown as ServerResponse;
        const req = {
          url: "/status",
          headers: { host: "localhost", ...headers },
          socket: { remoteAddress: remote },
        } as unknown as IncomingMessage;
        handleOpsHttp(req, res, { ...deps, remoteAddress: remote });
      });
    }

    const denied = await hit({});
    assert.equal(denied.status, 401);

    // Production: loopback alone is not enough — need bearer.
    const loopDenied = await hit({}, "127.0.0.1");
    assert.equal(loopDenied.status, 401);

    const ok = await hit({ authorization: "Bearer test-token" });
    assert.equal(ok.status, 200);
    assert.equal(JSON.parse(ok.body).ok, true);
  });

  it("handleOpsHttp serves /health /ready /status on loopback (dev)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "lok-ops-"));
    const deps = {
      lokReady: () => true,
      startedAtMs: Date.now(),
      dataDir: dir,
      env: { NETWORK: "anvil", LOK_CHAIN_ID: "31337" },
      remoteAddress: "127.0.0.1",
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
        const req = {
          url: path,
          headers: { host: "localhost" },
          socket: { remoteAddress: "127.0.0.1" },
        } as unknown as IncomingMessage;
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
    assert.equal(parsed.lastCertifiedHeight, null);
    assert.equal(parsed.lastAnchoredHeight, null);
    assert.equal(parsed.clockSkew, 0);
    assert.deepEqual(parsed.peers, []);
  });

  it("/status reports certified height, anchored height, clock skew, and peers", async () => {
    const dir = mkdtempSync(join(tmpdir(), "lok-ops-"));
    const deps = {
      lokReady: () => true,
      startedAtMs: Date.now(),
      dataDir: dir,
      env: { NETWORK: "anvil", LOK_CHAIN_ID: "31337" },
      remoteAddress: "127.0.0.1",
      replicaHealth: () => ({
        lastCertifiedHeight: 4,
        lastAnchoredHeight: null,
        clockSkew: 0,
        peers: [
          { address: "aa", heard: true },
          { address: "bb", heard: true },
          { address: "cc", heard: false },
        ],
        seedRoller: "bb",
      }),
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
        const req = {
          url: path,
          headers: { host: "localhost" },
          socket: { remoteAddress: "127.0.0.1" },
        } as unknown as IncomingMessage;
        assert.equal(handleOpsHttp(req, res, deps), true);
      });
    }

    const health = await hit("/health");
    assert.equal(health.status, 200);
    const healthBody = JSON.parse(health.body);
    assert.equal(healthBody.ok, true);
    assert.equal("lastCertifiedHeight" in healthBody, false);

    const status = await hit("/status");
    assert.equal(status.status, 200);
    const parsed = JSON.parse(status.body);
    assert.equal(parsed.lastCertifiedHeight, 4);
    assert.equal(parsed.lastAnchoredHeight, null);
    assert.equal(parsed.clockSkew, 0);
    assert.equal(parsed.peers.length, 3);
    assert.equal(parsed.peers[0].address, "aa");
    assert.equal(parsed.peers[0].heard, true);
    assert.equal(parsed.peers[2].heard, false);
    assert.equal(parsed.seedRoller, "bb");
  });

  it("POST /ops/replace-open-ask requires auth and wires replacePendingOpenAsk", async () => {
    const dir = mkdtempSync(join(tmpdir(), "lok-ops-"));
    let calledWith: string | null = null;
    const deps = {
      lokReady: () => true,
      startedAtMs: Date.now(),
      dataDir: dir,
      env: {
        NETWORK: "gnosis",
        LOK_CHAIN_ID: "100",
        LOK_OPS_STATUS_TOKEN: "ops-secret",
      },
      remoteAddress: "203.0.113.9",
      replacePendingOpenAsk: async (opts: { listingId: string }) => {
        calledWith = opts.listingId;
        return { ok: true as const, hash: ("0x" + "11".repeat(32)) as `0x${string}`, cleared: true };
      },
    };

    async function hit(opts: {
      auth?: string;
      body?: string;
      method?: string;
    }): Promise<{ status: number; body: string }> {
      return new Promise((resolve) => {
        let statusCode = 0;
        let body = "";
        const res = {
          writeHead(code: number) {
            statusCode = code;
          },
          end(chunk?: string) {
            body = chunk ?? "";
            resolve({ status: statusCode, body });
          },
        } as unknown as ServerResponse;
        const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};
        const req = {
          url: "/ops/replace-open-ask",
          method: opts.method ?? "POST",
          headers: {
            host: "localhost",
            ...(opts.auth ? { authorization: opts.auth } : {}),
          },
          socket: { remoteAddress: "203.0.113.9" },
          on(event: string, cb: (...args: unknown[]) => void) {
            (listeners[event] ??= []).push(cb);
            return req;
          },
          destroy() {},
        } as unknown as IncomingMessage;
        assert.equal(handleOpsHttp(req, res, deps), true);
        queueMicrotask(() => {
          if (opts.body != null) {
            for (const cb of listeners.data ?? []) cb(Buffer.from(opts.body));
          }
          for (const cb of listeners.end ?? []) cb();
        });
      });
    }

    const denied = await hit({ body: '{"listingId":"42"}' });
    assert.equal(denied.status, 401);

    const badMethod = await hit({
      auth: "Bearer ops-secret",
      method: "GET",
    });
    assert.equal(badMethod.status, 405);

    const ok = await hit({
      auth: "Bearer ops-secret",
      body: '{"listingId":"42"}',
    });
    assert.equal(ok.status, 200);
    assert.equal(JSON.parse(ok.body).ok, true);
    assert.equal(calledWith, "42");
  });

  it("ops replace errors scrub RPC URLs", async () => {
    const dir = mkdtempSync(join(tmpdir(), "lok-ops-"));
    const deps = {
      lokReady: () => true,
      startedAtMs: Date.now(),
      dataDir: dir,
      env: {
        NETWORK: "gnosis",
        LOK_CHAIN_ID: "100",
        LOK_OPS_STATUS_TOKEN: "ops-secret",
      },
      remoteAddress: "203.0.113.9",
      replacePendingOpenAsk: async () => ({
        ok: false as const,
        error: "RPC https://gnosis.example/v2/SECRET_KEY_HERE timed out",
      }),
    };
    const result = await new Promise<{ status: number; body: string }>((resolve) => {
      let statusCode = 0;
      let body = "";
      const res = {
        writeHead(code: number) {
          statusCode = code;
        },
        end(chunk?: string) {
          body = chunk ?? "";
          resolve({ status: statusCode, body });
        },
      } as unknown as ServerResponse;
      const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};
      const req = {
        url: "/ops/replace-open-ask",
        method: "POST",
        headers: { host: "localhost", authorization: "Bearer ops-secret" },
        socket: { remoteAddress: "203.0.113.9" },
        on(event: string, cb: (...args: unknown[]) => void) {
          (listeners[event] ??= []).push(cb);
          return req;
        },
        destroy() {},
      } as unknown as IncomingMessage;
      assert.equal(handleOpsHttp(req, res, deps), true);
      queueMicrotask(() => {
        for (const cb of listeners.data ?? []) cb(Buffer.from('{"listingId":"7"}'));
        for (const cb of listeners.end ?? []) cb();
      });
    });
    assert.equal(result.status, 400);
    const parsed = JSON.parse(result.body);
    assert.equal(parsed.ok, false);
    assert.doesNotMatch(parsed.error, /SECRET_KEY/);
    assert.match(parsed.error, /gnosis\.example/);
  });
});

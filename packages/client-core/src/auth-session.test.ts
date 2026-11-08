import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  clearAuthSession,
  clearResumeTokenKeepWallet,
  hasPersistedAuthForWallet,
  hasPersistedWalletAuth,
  loadAuthSession,
  resumeTokenForWallet,
  saveAuthSession,
} from "./auth-session";

const mem = new Map<string, string>();
const fake: Storage = {
  get length() {
    return mem.size;
  },
  clear() {
    mem.clear();
  },
  getItem(key) {
    return mem.get(key) ?? null;
  },
  key() {
    return null;
  },
  removeItem(key) {
    mem.delete(key);
  },
  setItem(key, value) {
    mem.set(key, String(value));
  },
};
Object.defineProperty(globalThis, "localStorage", { value: fake, configurable: true });

afterEach(() => {
  mem.clear();
});

test("save and load a resume session", () => {
  saveAuthSession({
    wallet: "0xAbCdEf0123456789abcdEF0123456789ABcdEf01",
    resumeToken: "ab".repeat(32),
  });
  const session = loadAuthSession();
  assert.equal(session?.wallet, "0xabcdef0123456789abcdef0123456789abcdef01");
  assert.equal(session?.resumeToken, "ab".repeat(32));
  assert.equal(hasPersistedWalletAuth(), true);
});

test("rejects a bad token and keeps the wallet", () => {
  saveAuthSession({
    wallet: "0xabcdef0123456789abcdef0123456789abcdef01",
    resumeToken: "not-a-token",
  });
  const session = loadAuthSession();
  assert.equal(session?.wallet, "0xabcdef0123456789abcdef0123456789abcdef01");
  assert.equal(session?.resumeToken, null);
});

test("clearResumeTokenKeepWallet drops only the token", () => {
  saveAuthSession({
    wallet: "0xabcdef0123456789abcdef0123456789abcdef01",
    resumeToken: "cd".repeat(32),
  });
  clearResumeTokenKeepWallet();
  const session = loadAuthSession();
  assert.equal(session?.wallet, "0xabcdef0123456789abcdef0123456789abcdef01");
  assert.equal(session?.resumeToken, null);
});

test("hasPersistedAuthForWallet is same-address only", () => {
  const a = "0xabcdef0123456789abcdef0123456789abcdef01";
  const b = "0x0c8F70DF8a57b08C0F1A5F516B5277b8a1e9620b";
  saveAuthSession({ wallet: a, resumeToken: null });
  assert.equal(hasPersistedAuthForWallet(a), true);
  assert.equal(hasPersistedAuthForWallet(b), false);
  assert.equal(hasPersistedWalletAuth(), true);
});

test("resumeTokenForWallet never attaches another wallet's token", () => {
  const a = "0xabcdef0123456789abcdef0123456789abcdef01";
  const b = "0xbbbbbb0123456789abcdef0123456789abcdef01";
  const token = "ab".repeat(32);
  saveAuthSession({ wallet: a, resumeToken: token });
  assert.equal(resumeTokenForWallet(a, token), token);
  assert.equal(resumeTokenForWallet(b, token), null);
  assert.equal(resumeTokenForWallet(b, null), null);
});

test("clearAuthSession removes the row", () => {
  saveAuthSession({
    wallet: "0xabcdef0123456789abcdef0123456789abcdef01",
    resumeToken: "ef".repeat(32),
  });
  clearAuthSession();
  assert.equal(loadAuthSession(), null);
  assert.equal(hasPersistedWalletAuth(), false);
});

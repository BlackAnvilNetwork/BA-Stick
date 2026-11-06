import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { clearPendingMint, readPendingMint, writePendingMint } from "./pending-mint";

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

const GAME = "0x0c8F70DF8a57b08C0F1A5F516B5277b8a1e9620b";
const PAYER = "0xe979111111111111111111111111111111111111";

test("writePendingMint is readable under both game and payer wallets", () => {
  writePendingMint({
    tokenId: "5",
    payer: PAYER,
    chainId: 100,
    factory: "0x4083Fe6C57c88abf8a422ebCF73EEa8320192cFD",
    nft: "0x6165040e7FE20Ae5Aac935898b9712818a3491cD",
    gameWallet: GAME,
  });
  assert.equal(readPendingMint(GAME)?.tokenId, "5");
  assert.equal(readPendingMint(PAYER)?.tokenId, "5");
  assert.equal(readPendingMint(PAYER, GAME)?.tokenId, "5");
});

test("clearPendingMint drops both game and payer keys", () => {
  writePendingMint({
    tokenId: "5",
    payer: PAYER,
    chainId: 100,
    factory: "0x4083Fe6C57c88abf8a422ebCF73EEa8320192cFD",
    nft: "0x6165040e7FE20Ae5Aac935898b9712818a3491cD",
    gameWallet: GAME,
  });
  clearPendingMint(GAME);
  assert.equal(readPendingMint(GAME), null);
  assert.equal(readPendingMint(PAYER), null);
});

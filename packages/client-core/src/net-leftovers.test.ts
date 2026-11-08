import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  createEnterIdAfterAuthOk,
  hydratedResumeToken,
  npcDialogAfterSnapshot,
  shouldAdoptLiveWallet,
  shouldAllowSilentHello,
  shouldApplyCreateSnapshotHud,
  shouldBeginAuthHello,
  shouldClaimStarterOnSnapshot,
  shouldClearPendingCreateEnterOnAuthOk,
  shouldKickLeftoverBurnerOnAuthOk,
  shouldRefuseLeftoverBurnerSession,
  phaseAfterOwnedRoster,
  shouldRequestOwnedNftSync,
  shouldResetSessionOnWalletSwitch,
  shouldStayOnCreateAfterAuthOk,
} from "./net-leftovers";

test("rejected or missing-wallet sign returns to auth", () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "net.ts"), "utf8");
  assert.match(src, /Connect a wallet to sign in\.[\s\S]{0,120}setPhase\("auth"\)/);
  assert.match(src, /Could not sign the login challenge\.[\s\S]{0,120}setPhase\("auth"\)/);
  assert.match(src, /isStoredLocalBurnerWallet\(msg\.wallet\)/);
  assert.match(src, /leftover local browser wallet cannot play on Gnosis/);
  assert.match(src, /resumeToken = hydratedResumeToken\(session\?\.resumeToken\)/);
  assert.match(src, /shouldRefuseLeftoverBurnerSession\(/);
  assert.match(src, /refuseLeftoverBurnerAndStayOnAuth\(\);[\s\S]{0,40}return;/);
  assert.match(src, /shouldKickLeftoverBurnerOnAuthOk\(isStoredLocalBurnerWallet\(msg\.wallet\)\)/);
  assert.match(src, /resumeTokenForWallet\(wallet, resumeToken\)/);
  assert.match(src, /shouldAdoptLiveWallet\(live, persisted\.wallet\)/);
  assert.match(src, /shouldResetSessionOnWalletSwitch\(prevWallet, address\)/);
  assert.match(src, /dropGameSessionForWalletSwitch\(\)/);
  assert.match(src, /dropGameSessionForWalletSwitch[\s\S]{0,200}type: "auth\/logout"/);
  assert.match(src, /shouldAllowSilentHello\("resume-miss"\)/);
  assert.match(src, /shouldBeginAuthHello\(/);
  assert.doesNotMatch(src, /allowSilentHello = true;\s*if \(msg\.resumeToken\)/);
  assert.doesNotMatch(src, /mintChain === 100 \|\| mintChain === 10200/);
  assert.match(src, /shouldRequestOwnedNftSync\(/);
  assert.match(src, /type: "char\/syncOwned"/);
  assert.match(src, /msg.type === "char\/roster"/);
});

test("auth/ok keeps pending create enter and claims starter on snapshot", () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "net.ts"), "utf8");
  assert.match(src, /shouldClearPendingCreateEnterOnAuthOk\(g\.pendingCreateEnter\)/);
  assert.match(src, /createEnterIdAfterAuthOk\(/);
  assert.match(src, /shouldClaimStarterOnSnapshot\(g\.pendingCreateEnter\)/);
  assert.match(src, /shouldApplyCreateSnapshotHud\(g\.phase, g\.pendingCreateEnter\)/);
  assert.match(src, /shouldStayOnCreateAfterAuthOk\(g\.pendingCreateEnter, createEnterId\)/);
  assert.match(src, /send\(\{ type: "claim\/starter" \}\)/);
});

test("create snapshot does not hijack select and mid-create stays on create", () => {
  assert.equal(shouldApplyCreateSnapshotHud("play", false), true);
  assert.equal(shouldApplyCreateSnapshotHud("select", true), false);
  assert.equal(shouldApplyCreateSnapshotHud("select", false), false);
  assert.equal(shouldApplyCreateSnapshotHud("create", false), false);
  assert.equal(shouldApplyCreateSnapshotHud("create", true), true);
  assert.equal(shouldStayOnCreateAfterAuthOk(true, null), true);
  assert.equal(shouldStayOnCreateAfterAuthOk(true, "new"), false);
  assert.equal(shouldStayOnCreateAfterAuthOk(false, null), false);
});

test("setSnapshot clears npcDialog after a zone hand-off", () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "state.ts"), "utf8");
  assert.match(
    src,
    /npcDialog: npcDialogAfterSnapshot\(prev\?\.you\.zoneId, snapshot\.you\.zoneId, get\(\)\.npcDialog\)/,
  );
  assert.match(src, /clearSnapshot: \(\) =>[\s\S]*npcDialog: null,[\s\S]*pvpSlainPrompt: null/);
});

test("pending create survive auth/ok and pick the new roster id", () => {
  assert.equal(shouldClearPendingCreateEnterOnAuthOk(true), false);
  assert.equal(shouldClearPendingCreateEnterOnAuthOk(false), true);
  assert.equal(createEnterIdAfterAuthOk(false, [], ["a"]), null);
  assert.equal(createEnterIdAfterAuthOk(true, [], []), null);
  assert.equal(createEnterIdAfterAuthOk(true, ["old"], ["old"]), null);
  assert.equal(createEnterIdAfterAuthOk(true, ["old"], ["old", "new"]), "new");
  assert.equal(createEnterIdAfterAuthOk(true, [], ["only"]), "only");
});

test("claim/starter waits for the create snapshot", () => {
  assert.equal(shouldClaimStarterOnSnapshot(false), false);
  assert.equal(shouldClaimStarterOnSnapshot(true), true);
});

test("leftover burner and silent-hello contract", () => {
  assert.equal(shouldRefuseLeftoverBurnerSession(null, true), false);
  assert.equal(shouldRefuseLeftoverBurnerSession("0xe979", true), true);
  assert.equal(shouldKickLeftoverBurnerOnAuthOk(true), true);
  assert.equal(shouldKickLeftoverBurnerOnAuthOk(false), false);
  assert.equal(hydratedResumeToken(undefined), null);
  assert.equal(hydratedResumeToken("ab".repeat(32)), "ab".repeat(32));
  assert.equal(shouldAllowSilentHello("resume-miss"), true);
  assert.equal(shouldAllowSilentHello("auth-ok"), false);
  assert.equal(shouldAllowSilentHello("restore"), false);
  assert.equal(shouldAllowSilentHello("login"), false);
  assert.equal(
    shouldBeginAuthHello({
      address: "0x0c8F",
      authInFlight: true,
      authInFlightWallet: "0x0c8F",
    }),
    false,
  );
  assert.equal(
    shouldBeginAuthHello({
      address: "0x0c8F",
      authInFlight: true,
      authInFlightWallet: "0x0c8F",
      force: true,
    }),
    false,
  );
  assert.equal(
    shouldBeginAuthHello({
      address: "0x0c8F",
      authInFlight: false,
      authInFlightWallet: null,
    }),
    true,
  );
  assert.equal(
    shouldAdoptLiveWallet("0x0c8F70DF8a57b08C0F1A5F516B5277b8a1e9620b", "0xe979"),
    true,
  );
  assert.equal(
    shouldAdoptLiveWallet(
      "0x0c8F70DF8a57b08C0F1A5F516B5277b8a1e9620b",
      "0x0c8F70DF8a57b08C0F1A5F516B5277b8a1e9620b",
    ),
    false,
  );
  assert.equal(
    shouldResetSessionOnWalletSwitch("0xaaa", "0xbbb"),
    true,
  );
  assert.equal(
    shouldResetSessionOnWalletSwitch(
      "0x0c8F70DF8a57b08C0F1A5F516B5277b8a1e9620b",
      "0x0c8F70DF8a57b08C0F1A5F516B5277b8a1e9620b",
    ),
    false,
  );
  assert.equal(shouldResetSessionOnWalletSwitch(null, "0xbbb"), false);
});

test("empty mint-chain roster syncs wallet NFTs onto select", () => {
  assert.equal(shouldRequestOwnedNftSync({ rosterCount: 0, hasMintConfig: true }), true);
  assert.equal(shouldRequestOwnedNftSync({ rosterCount: 1, hasMintConfig: true }), false);
  assert.equal(shouldRequestOwnedNftSync({ rosterCount: 0, hasMintConfig: false }), false);
  assert.equal(shouldRequestOwnedNftSync({ rosterCount: 1, hasMintConfig: true, creating: true }), true);
  assert.equal(
    phaseAfterOwnedRoster({ rosterCount: 1, pendingCreateEnter: false, phase: "select" }),
    "select",
  );
  assert.equal(
    phaseAfterOwnedRoster({ rosterCount: 0, pendingCreateEnter: false, phase: "select" }),
    "create",
  );
  assert.equal(
    phaseAfterOwnedRoster({ rosterCount: 0, pendingCreateEnter: true, phase: "create" }),
    "keep",
  );
  assert.equal(
    phaseAfterOwnedRoster({ rosterCount: 1, pendingCreateEnter: false, phase: "play" }),
    "keep",
  );
});

test("zone change drops the NPC dialog", () => {
  const dialog = { npcId: "smith" };
  assert.equal(npcDialogAfterSnapshot(undefined, "pale_hollow", dialog), dialog);
  assert.equal(npcDialogAfterSnapshot("pale_hollow", "pale_hollow", dialog), dialog);
  assert.equal(npcDialogAfterSnapshot("pale_hollow", "emberwatch", dialog), null);
  assert.equal(npcDialogAfterSnapshot("pale_hollow", undefined, dialog), dialog);
});

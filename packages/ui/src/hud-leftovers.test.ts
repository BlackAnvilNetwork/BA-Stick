import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  appKitModalView,
  applyStayOpenToggle,
  createSubmitLabel,
  hideBootScreen,
  playEscapeLayer,
  shouldAcceptWalletConnectClick,
  shouldAutoLoginAppKit,
  shouldDisableWalletControl,
  shouldForceWalletLogin,
  shouldHideWalletControlWhileModal,
  shouldKeepBootWiki,
  shouldKickLeftoverBurnerToAuth,
  shouldResetPlayOverlays,
  shouldRunCreateMint,
  shouldSendMintWallet,
  shouldSkipCreateNameCheck,
  truncateWalletLabel,
  walletControlLabel,
} from "./hud-leftovers";

test("boot overlay hides on play without waiting for a snapshot", () => {
  assert.equal(hideBootScreen("play"), true);
  assert.equal(hideBootScreen("boot"), false);
  assert.equal(hideBootScreen("auth"), false);
  assert.equal(hideBootScreen("select"), false);
  assert.equal(hideBootScreen("create"), false);
});

test("crafter and exchange auto-open do not toggle off", () => {
  assert.deepEqual(applyStayOpenToggle(true, true), { open: true, stayOpen: false });
  assert.deepEqual(applyStayOpenToggle(false, true), { open: true, stayOpen: false });
  assert.deepEqual(applyStayOpenToggle(true, false), { open: false, stayOpen: false });
  assert.deepEqual(applyStayOpenToggle(false, false), { open: true, stayOpen: false });
});

test("Hud wires leftover boot, wallet, pane, and panel fixes", () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "Hud.tsx"), "utf8");
  assert.match(src, /if \(hideBootScreen\(phase\)\) return null;/);
  assert.match(src, /shouldAutoLoginAppKit\(\{/);
  assert.match(src, /alreadyAuthed: isServerAuthed\(\) && sameWallet/);
  assert.match(src, /accountSwitch/);
  assert.match(src, /shouldForceWalletLogin\(userClicked\.current\) \|\| accountSwitch/);
  assert.match(src, /leftPaneIntent\.current = "auto";\s*setLeftPane\(cur\.minimap \? "map" : "log"\)/);
  assert.match(src, /craftStayOpen\.current = true;/);
  assert.match(src, /lokStayOpen\.current = true;/);
  assert.match(src, /playEscapeLayer\(\{/);
  assert.match(src, /layer === "bag"/);
  assert.match(src, /layer === "party"/);
  assert.match(src, /skills: treeOpen/);
  assert.match(src, /exchange: lokOpen/);
  assert.match(src, /quest: questOpen/);
  assert.match(src, /explorer: explorerOpen/);
  assert.match(src, /ashPit: ashPitOpen/);
  assert.match(src, /layer === "skills"/);
  assert.match(src, /layer === "exchange"/);
  assert.match(src, /layer === "ashPit"/);
  assert.match(src, /shouldAcceptWalletConnectClick\(busy\)/);
  assert.match(src, /loginWithWalletConnect\(\{/);
  assert.match(src, /appKitAlreadyOpen: true/);
  assert.match(src, /force: true/);
  assert.match(src, /open\(\{ view: "Account" \}\)/);
  assert.match(src, /appKitModalView\(isConnected\)/);
  assert.match(src, /shouldHideWalletControlWhileModal\(modalOpen\)/);
  assert.match(src, /shouldSendMintWallet\(res\.payer, gameWallet\)/);
  assert.match(src, /shouldSkipCreateNameCheck\(\!\!pendingMint\)/);
  assert.match(src, /createSubmitLabel\(/);
  assert.match(src, /hasPersistedAuthForWallet\(address\)/);
  assert.doesNotMatch(src, /hasPersistedWalletAuth\(\) \|\|/);
  assert.equal((src.match(/<WalletConnectButton/g) ?? []).length, 1);
  assert.match(src, /<WalletConnectButton \/>/);
  assert.match(src, /Reading characters from your wallet/);
  assert.match(src, /boot-char-level/);
  assert.match(src, /Lv\.\{c\.level\}/);
  assert.doesNotMatch(src, /NFT #\$\{c\.tokenId\}/);
  assert.match(src, /kickLeftoverBurnerToAuth\(\)/);
  assert.doesNotMatch(src, /Click Connect Wallet, pick that account/);
  assert.match(src, /mintTimer\.current = window\.setTimeout/);
  assert.match(src, /cancelCreateMint\(\)/);
  assert.match(src, /shouldRunCreateMint\(leftCreate\.current\)/);
  assert.match(src, /if \(!shouldResetPlayOverlays\(phase\)\) return;/);
  assert.match(src, /setMenuLocked\(false\)/);
  assert.doesNotMatch(src, /setTimeout\(\(\) => send\(\{ type: "claim\/starter" \}\), 100\)/);
});

test("leaving play resets overlays and wiki is boot-only", () => {
  assert.equal(shouldResetPlayOverlays("play"), false);
  assert.equal(shouldResetPlayOverlays("select"), true);
  assert.equal(shouldResetPlayOverlays("create"), true);
  assert.equal(shouldKeepBootWiki("boot"), true);
  assert.equal(shouldKeepBootWiki("select"), true);
  assert.equal(shouldKeepBootWiki("play"), false);
});

test("play Escape closes overlays before disengage", () => {
  assert.equal(playEscapeLayer({ settings: true, commands: true, bag: true }), "settings");
  assert.equal(playEscapeLayer({ commands: true, bag: true }), "commands");
  assert.equal(playEscapeLayer({ bag: true, craft: true }), "bag");
  assert.equal(playEscapeLayer({ craft: true }), "craft");
  assert.equal(playEscapeLayer({ spellbook: true }), "spellbook");
  assert.equal(playEscapeLayer({ party: true }), "party");
  assert.equal(playEscapeLayer({ skills: true }), "skills");
  assert.equal(playEscapeLayer({ exchange: true }), "exchange");
  assert.equal(playEscapeLayer({ quest: true }), "quest");
  assert.equal(playEscapeLayer({ explorer: true }), "explorer");
  assert.equal(playEscapeLayer({ ashPit: true }), "ashPit");
  assert.equal(playEscapeLayer({ npc: true }), "npc");
  assert.equal(playEscapeLayer({}), "disengage");
});

test("Connect click is not swallowed by an existing session", () => {
  assert.equal(shouldAcceptWalletConnectClick(false), true);
  assert.equal(shouldAcceptWalletConnectClick(true), false);
  assert.equal(shouldDisableWalletControl(true, false), true);
  assert.equal(shouldDisableWalletControl(true, true), false);
  assert.equal(shouldForceWalletLogin(true), true);
  assert.equal(shouldForceWalletLogin(false), false);
  assert.equal(appKitModalView(false), "Connect");
  assert.equal(appKitModalView(true), "Account");
  assert.equal(truncateWalletLabel("0x0c8F70DF8a57b08C0F1A5F516B5277b8a1e9620b"), "0x0c8F…620b");
  assert.equal(
    walletControlLabel({ busy: false, connected: false }),
    "Connect Wallet",
  );
  assert.equal(
    walletControlLabel({
      busy: true,
      connected: true,
      address: "0x0c8F70DF8a57b08C0F1A5F516B5277b8a1e9620b",
    }),
    "0x0c8F…620b",
  );
  assert.equal(
    shouldAutoLoginAppKit({
      connected: true,
      address: "0xabc",
      persisted: true,
      userClicked: false,
      alreadyAuthed: false,
    }),
    true,
  );
  assert.equal(
    shouldAutoLoginAppKit({
      connected: true,
      address: "0xabc",
      persisted: true,
      userClicked: false,
      alreadyAuthed: true,
    }),
    false,
  );
  assert.equal(
    shouldAutoLoginAppKit({
      connected: true,
      address: "0xabc",
      persisted: false,
      userClicked: true,
      alreadyAuthed: true,
    }),
    true,
  );
  assert.equal(
    shouldAutoLoginAppKit({
      connected: true,
      address: "0xabc",
      persisted: false,
      userClicked: false,
      alreadyAuthed: false,
    }),
    false,
  );
  assert.equal(
    shouldAutoLoginAppKit({
      connected: true,
      address: "0xdef",
      persisted: false,
      userClicked: false,
      alreadyAuthed: false,
      accountSwitch: true,
    }),
    true,
  );
  assert.equal(
    shouldAutoLoginAppKit({
      connected: true,
      address: "0xdef",
      persisted: false,
      userClicked: false,
      alreadyAuthed: true,
      authInFlight: true,
      startedFor: "0xabc",
      accountSwitch: true,
    }),
    true,
  );
  assert.equal(
    shouldAutoLoginAppKit({
      connected: true,
      address: "0x0c8F70DF8a57b08C0F1A5F516B5277b8a1e9620b",
      persisted: false,
      userClicked: false,
      alreadyAuthed: false,
      leftoverReplace: true,
    }),
    true,
  );
  assert.equal(
    shouldAutoLoginAppKit({
      connected: true,
      address: "0x0c8F70DF8a57b08C0F1A5F516B5277b8a1e9620b",
      persisted: false,
      userClicked: false,
      alreadyAuthed: false,
      unsignedLive: true,
    }),
    true,
  );
  assert.equal(
    shouldAutoLoginAppKit({
      connected: true,
      address: "0xabc",
      persisted: true,
      userClicked: false,
      alreadyAuthed: false,
      startedFor: "0xabc",
    }),
    false,
  );
  assert.equal(
    shouldAutoLoginAppKit({
      connected: true,
      address: "0xabc",
      persisted: true,
      userClicked: false,
      alreadyAuthed: false,
      authInFlight: true,
    }),
    false,
  );
  assert.equal(shouldKickLeftoverBurnerToAuth(null, true), false);
  assert.equal(shouldKickLeftoverBurnerToAuth("0xe979", true), true);
  assert.equal(shouldHideWalletControlWhileModal(true), true);
  assert.equal(shouldHideWalletControlWhileModal(false), false);
  assert.equal(
    shouldSendMintWallet(
      "0x0c8F70DF8a57b08C0F1A5F516B5277b8a1e9620b",
      "0x0c8F70DF8a57b08C0F1A5F516B5277b8a1e9620b",
    ),
    false,
  );
  assert.equal(
    shouldSendMintWallet(
      "0xe979111111111111111111111111111111111111",
      "0x0c8F70DF8a57b08C0F1A5F516B5277b8a1e9620b",
    ),
    true,
  );
  assert.equal(shouldSkipCreateNameCheck(true), true);
  assert.equal(shouldSkipCreateNameCheck(false), false);
  assert.equal(createSubmitLabel("Druid", true), "Create Druid");
  assert.equal(createSubmitLabel("Druid", false), "Create Druid · Claim starter");
});

test("create mint does not run after the form is left", () => {
  assert.equal(shouldRunCreateMint(false), true);
  assert.equal(shouldRunCreateMint(true), false);
});

test("Job Master sends job/change for main job", () => {
  const src = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "NpcInteractMenu.tsx"),
    "utf8",
  );
  assert.match(src, /send\(\{ type: "job\/change", job \}\)/);
  assert.match(src, /Change Job/);
  assert.match(src, /Change Alt/);
});

test("App capture skips Escape and clears the virtual stick on leave play", () => {
  const src = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../../../apps/stick-web/src/App.tsx"),
    "utf8",
  );
  assert.match(src, /clearVirtualStick\(\)/);
  assert.match(src, /if \(e\.key === "Escape"\) return;/);
  assert.match(src, /addEventListener\("keydown", onEscapeBubble\)/);
});

test("boot wiki closes off menu phases and WikiPage consumes Escape", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "../../../apps/stick-web/src");
  const boot = readFileSync(join(root, "BootWikiButton.tsx"), "utf8");
  assert.match(boot, /shouldKeepBootWiki\(phase\)/);
  assert.match(boot, /setOpen\(false\)/);
  const wiki = readFileSync(join(root, "WikiPage.tsx"), "utf8");
  assert.match(wiki, /if \(e\.key !== "Escape"\) return;/);
  assert.match(wiki, /onClose\(\)/);
});

/**
 * Regression tests for PvP slay / AH fill / Ash Pit gear paths in index.ts.
 * Does not import the server entrypoint (that boots HTTP + LokWorld).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { abilityTargetFaction } from "@bellgrave/combat";
import { ASH_PIT } from "@bellgrave/config";
import { aggregateEquipmentStatsScaled, getItem } from "@bellgrave/items";
import { meleeAtkBonus } from "./gear-combat";
import { canPvpStrike, effectivePvpMainLevel } from "./pvp";

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "index.ts"), "utf8");

function sliceFn(name: string): string {
  const start = src.indexOf(`function ${name}`);
  assert.ok(start >= 0, `missing function ${name}`);
  const next = src.indexOf("\nfunction ", start + 1);
  return src.slice(start, next < 0 ? undefined : next);
}

describe("pvp-slay-victim-live + pvp-heal-during-claim-delay", () => {
  test("handlePvpSlay locks the victim before chainPvpClaim", () => {
    const body = sliceFn("handlePvpSlay");
    assert.match(body, /beginPvpSlayLock\(victim\)/);
    assert.ok(
      body.indexOf("beginPvpSlayLock(victim)") < body.indexOf("chainPvpClaim"),
      "victim must be locked before the claim await",
    );
    assert.match(body, /if \(pvpSlayInFlight\.has\(victimToken\)\) return/);
  });

  test("slay lock freezes the victim so ticks cannot heal or cancel", () => {
    assert.match(src, /victim\.hp = 0/);
    assert.match(src, /victim\.fallenUntil = now \+ FALLEN_WINDOW_MS/);
    assert.match(src, /victim\.regenUntil = 0/);
    assert.match(sliceFn("tickSimBody"), /if \(playerPvpSlayLocked\(p\)\)/);
    assert.match(sliceFn("tickPvpBountyArea"), /if \(pvpSlayInFlight\.has\(tokenId\)\) return/);
    assert.match(sliceFn("handleAbility"), /playerPvpSlayLocked\(foe\)/);
  });
});

describe("bio-dot-repeat-slay + bio-slay-skips-strike-check + poison-dot-skips-pvp-slay", () => {
  test("poison death in a PvP area claims through a strike-gated slayer", () => {
    const poison = sliceFn("tickSimBody");
    assert.match(poison, /resolvePvpDotSlayer\(p\)/);
    assert.match(poison, /handlePvpSlay\(slayer, p, area\.id\)/);
    const slayer = sliceFn("resolvePvpDotSlayer");
    assert.match(slayer, /pvpStrikeBlock\(slayer, victim\)/);
    assert.match(slayer, /poisonSourceWallet \?\? victim\.lastPvpHitBy/);
  });

  test("canPvpStrike fails when the source has left the arena", () => {
    const pit = { x: ASH_PIT.spawn.x, z: ASH_PIT.spawn.z };
    const hub = { x: 0, z: 0 };
    const inside = canPvpStrike(pit, pit, true);
    assert.equal(inside.ok, true);
    const left = canPvpStrike(hub, pit, true);
    assert.equal(left.ok, false);
    if (!left.ok) assert.match(left.reason, /Not in a PvP area/);
  });
});

describe("pvp-area-anchor-spam", () => {
  test("tickPvpBountyArea tells ANCHOR_WAIT once and holds the in-flight cancel", () => {
    const body = sliceFn("tickPvpBountyArea");
    assert.match(body, /chainBoundSendGate\(\)/);
    assert.match(body, /pvpAreaCancelGateTold/);
    assert.match(body, /pvpAreaCancelInFlight/);
  });
});

describe("pvp-join-during-cancel", () => {
  test("Already marked join refuses while cancel or slay is in flight", () => {
    const body = sliceFn("handlePvpJoin");
    assert.match(body, /pvpAreaCancelInFlight\.has\(tokenId\)/);
    assert.match(body, /pvpSlayInFlight\.has\(tokenId\)/);
    assert.ok(
      body.indexOf("pvpAreaCancelInFlight") < body.indexOf("warpIntoPit(p, pit, false)"),
      "cancel guard must run before the already-marked warp",
    );
  });
});

describe("ability-ally-hits-pvp-strike-block", () => {
  test("cleric cures are ally-faction; battle-mage fire is not", () => {
    assert.equal(abilityTargetFaction("cl_cure"), "ally");
    assert.equal(abilityTargetFaction("cl_cure_iii"), "ally");
    assert.equal(abilityTargetFaction("bm_fire"), "enemy");
  });

  test("handleAbility strike-gates only non-ally player targets", () => {
    const body = sliceFn("handleAbility");
    assert.match(body, /abilityTargetFaction\(id\) === "ally"/);
    assert.match(body, /pvpStrikeBlock\(p, foe\)/);
    assert.ok(
      body.indexOf('abilityTargetFaction(id) === "ally"') < body.indexOf("pvpStrikeBlock(p, foe)"),
    );
  });
});

describe("ash-pit-gear-uncapped", () => {
  const IRON_MAIL = 5;
  const mail = getItem(IRON_MAIL);
  assert.ok(mail);
  assert.equal(mail.craftLevel, 28);
  assert.equal(mail.stats?.def, 20);
  assert.equal(mail.stats?.hp, 29);

  test("Ash Pit clamps a L75 to 30 before gear scale", () => {
    assert.equal(effectivePvpMainLevel(75, ASH_PIT), 30);
    assert.equal(effectivePvpMainLevel(30, ASH_PIT), 30);
    const capped = aggregateEquipmentStatsScaled({ body: IRON_MAIL }, effectivePvpMainLevel(75, ASH_PIT));
    const trueLevel = aggregateEquipmentStatsScaled({ body: IRON_MAIL }, 75);
    assert.equal(capped.def, 20);
    assert.equal(capped.hp, 29);
    assert.equal(trueLevel.def, 20);
    const low = aggregateEquipmentStatsScaled({ body: IRON_MAIL }, effectivePvpMainLevel(14, ASH_PIT));
    assert.equal(low.def, 10);
  });

  test("playerEquipmentStats and weapon bonus use combatGearLevel", () => {
    assert.match(sliceFn("combatGearLevel"), /effectivePvpMainLevel\(p\.level, areaAtPlayer/);
    assert.match(sliceFn("playerEquipmentStats"), /combatGearLevel\(p\)/);
    assert.match(sliceFn("playerWeaponBonus"), /combatGearLevel\(p\)/);
    const atkCap = meleeAtkBonus({ equip: { main: 1 }, level: effectivePvpMainLevel(75, ASH_PIT) });
    const atkRaw = meleeAtkBonus({ equip: { main: 1 }, level: 75 });
    assert.equal(typeof atkCap, "number");
    assert.equal(typeof atkRaw, "number");
  });
});

describe("ah-admit-any-wallet", () => {
  test("hold book is per-wallet; another wallet cannot pin or release", () => {
    const book = new Map<string, { priceWei: bigint; epoch: number }>();
    const peek = (wallet: string) =>
      book.has(wallet.toLowerCase()) ? "You already have an auction hold open." : null;
    const note = (wallet: string, priceWei: bigint, epoch: number) => {
      book.set(wallet.toLowerCase(), { priceWei, epoch });
    };
    const take = (wallet: string, priceWei: bigint, epoch: number) => {
      const key = wallet.toLowerCase();
      const row = book.get(key);
      if (!row || row.priceWei !== priceWei || row.epoch !== epoch) return false;
      book.delete(key);
      return true;
    };

    const a = "0xaaa";
    const b = "0xbbb";
    assert.equal(peek(a), null);
    note(a, 10n, 3);
    assert.equal(peek(a), "You already have an auction hold open.");
    assert.equal(peek(b), null);
    assert.equal(take(b, 10n, 3), false);
    assert.equal(take(a, 9n, 3), false);
    assert.equal(take(a, 10n, 3), true);
    assert.equal(peek(a), null);
  });

  test("index.ts pin/release require takeAhFillHold for the authed wallet", () => {
    assert.match(src, /function peekAhFillHold/);
    assert.match(src, /function noteAhFillHold/);
    assert.match(src, /function takeAhFillHold/);
    assert.match(src, /if \(!takeAhFillHold\(wallet, BigInt\(msg\.priceWei\), msg\.epoch\)\)/);
    assert.match(src, /No auction hold for this wallet/);
  });
});

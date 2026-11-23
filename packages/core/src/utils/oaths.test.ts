import { orders, TroopTier, TroopType } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";
import { type NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import { nativeOathConstants as oaths } from "../../../../contracts/l3/world-native/schema/balance.gen";
import { chooseOath, oathCards, oathRerollIndex, rerollOath } from "./oaths";

const pick = oaths.POWER - 1 + ((oaths.FOX - 1) << 4) + ((oaths.RAGE - 1) << 8);
const progress: NativeRows["ArmyProgress"] = {
  game_id: 1,
  explorer_id: 1n,
  logistics: 0,
  oath_slots: 1,
  oaths: 0,
  oath_pick: pick,
};

describe("Oath picks", () => {
  it("uses the existing Order ids for every named Oath", () => {
    const names = orders
      .filter(({ orderId }) => orderId !== 0)
      .map(({ orderName }) => {
        const entry = Object.entries(oaths).find(([name]) => name === orderName.toUpperCase());
        if (!entry) throw new Error(`Missing native Oath ${orderName}`);
        return entry;
      });
    expect(names).toHaveLength(orders.length - 1);
    for (const [name, id] of names) {
      expect(orders.find(({ orderId }) => orderId === id)?.orderName.toUpperCase()).toBe(name);
    }
  });
  it("reads the three cards of a pick from the one bag of sixteen, a repeated card as one fewer", () => {
    expect(oathCards(pick)).toEqual([oaths.POWER, oaths.FOX, oaths.RAGE]);
    expect(oathCards(oaths.SKILL - 1 + ((oaths.POWER - 1) << 4) + ((oaths.GIANTS - 1) << 8))).toEqual([
      oaths.SKILL,
      oaths.POWER,
      oaths.GIANTS,
    ]);
    expect(oathCards(oaths.SKILL - 1 + ((oaths.FOX - 1) << 4) + ((oaths.FOX - 1) << 8))).toEqual([
      oaths.SKILL,
      oaths.FOX,
    ]);
    expect(oathCards(0)).toEqual([]);
  });
  it("takes, replaces and declines without changing capacity or logistics", () => {
    const chosen = chooseOath(progress, pick, oaths.POWER, null);
    expect(chosen).toEqual({ ...progress, oaths: 1 << (oaths.POWER - 1), oath_pick: 0 });
    const next = { ...chosen, oath_pick: pick };
    expect(() => chooseOath(next, pick, oaths.FOX, null)).toThrow("replace");
    expect(chooseOath(next, pick, oaths.FOX, oaths.POWER)).toEqual({ ...chosen, oaths: 1 << (oaths.FOX - 1) });
    expect(chooseOath(next, pick, null, null)).toEqual(chosen);
    expect(() => chooseOath(chosen, pick, oaths.FOX, null)).toThrow("changed");
    expect(() => chooseOath(progress, pick, oaths.GIANTS, null)).toThrow("not offered");
    expect(() => chooseOath(progress, pick, oaths.FOX, oaths.POWER)).toThrow("Empty");
  });
  it("redraws one card of a pick once, to an Oath neither held nor shown, and the redrawn card can be taken", () => {
    const bit = (oath: number) => 1 << (oath - 1);
    const rerolled = rerollOath(progress, pick, 1, oaths.SKILL);
    expect(rerolled.oath_pick).toBe(
      oaths.POWER - 1 + ((oaths.SKILL - 1) << 4) + ((oaths.RAGE - 1) << 8) + oaths.REROLLED,
    );
    expect(oathCards(rerolled.oath_pick)).toEqual([oaths.POWER, oaths.SKILL, oaths.RAGE]);
    expect(oathRerollIndex(pick, 0, oaths.RAGE)).toBe(2);
    expect(oathRerollIndex(rerolled.oath_pick, 0, oaths.SKILL)).toBeNull();
    expect(oathRerollIndex(rerolled.oath_pick, 0, oaths.RAGE)).toBeNull();
    expect(() => rerollOath(rerolled, rerolled.oath_pick, 2, oaths.GIANTS)).toThrow("not rerollable");
    expect(() => rerollOath(progress, pick, 0, oaths.FOX)).toThrow("not drawable");
    expect(() => rerollOath({ ...progress, oaths: bit(oaths.SKILL) }, pick, 0, oaths.SKILL)).toThrow("not drawable");
    expect(() => rerollOath(progress, rerolled.oath_pick, 0, oaths.GIANTS)).toThrow("changed");
    const allButShown = 65535 ^ bit(oaths.POWER) ^ bit(oaths.FOX) ^ bit(oaths.RAGE);
    expect(oathRerollIndex(pick, allButShown, oaths.POWER)).toBeNull();
    expect(chooseOath(rerolled, rerolled.oath_pick, oaths.SKILL, null).oaths).toBe(bit(oaths.SKILL));
    expect(() => oathCards(oaths.REROLLED * 2)).toThrow("Invalid");
  });
});

it("matches the native Deep loss vectors for each held set and tick boundary", async () => {
  const { readFileSync } = await import("node:fs");
  const { oathDeepLossPerTick } = await import("./oaths");
  const fields = readFileSync(
    new URL("../../../../contracts/l3/world-native/tests/fixtures/oath-deep-loss.txt", import.meta.url),
    "utf8",
  )
    .trim()
    .split(/\s+/)
    .map(BigInt);
  expect(fields.length).toBe(48);
  while (fields.length) {
    const [held, base, , , expectedLoss] = fields.splice(0, 6) as [bigint, bigint, bigint, bigint, bigint, bigint];
    const loss = oathDeepLossPerTick(Number(held), base);
    expect(loss).toBe(expectedLoss);
  }
});

it("matches the native pass vectors below, at and near the maximum", async () => {
  const { readFileSync } = await import("node:fs");
  const { oathPassStamina } = await import("./oaths");
  const fields = readFileSync(
    new URL("../../../../contracts/l3/world-native/tests/fixtures/oath-pass-stamina.txt", import.meta.url),
    "utf8",
  )
    .trim()
    .split(/\s+/)
    .map(Number);
  expect(fields).toHaveLength(8);
  for (const maximum of [150, 240, 420]) {
    for (let i = 0; i < fields.length; i += 2) {
      const current = maximum - fields[i]!;
      expect(oathPassStamina(current, maximum)).toBe(current + fields[i + 1]!);
    }
  }
});

it("matches the native prize vectors for Brilliance and Rage", async () => {
  const { readFileSync } = await import("node:fs");
  const { oathRevealPay, oathSitePay } = await import("./oaths");
  const fields = readFileSync(
    new URL("../../../../contracts/l3/world-native/tests/fixtures/oath-prizes.txt", import.meta.url),
    "utf8",
  )
    .trim()
    .split(/\s+/)
    .map(BigInt);
  expect(fields).toHaveLength(72);
  while (fields.length) {
    const [held, , , amount, reveal, site] = fields.splice(0, 6) as [bigint, bigint, bigint, bigint, bigint, bigint];
    expect(oathRevealPay(Number(held), amount)).toBe(reveal);
    expect(oathSitePay(Number(held), amount, false)).toBe(site);
  }
});

it("matches the native stamina vectors for Anger, Titans, Enlightenment and the Fox", async () => {
  const { readFileSync } = await import("node:fs");
  const { oathAttackStamina, oathExploreStamina, oathRegenBps, oathStaminaBonus } = await import("./oaths");
  const { staminaAt } = await import("../managers/troop-stamina");
  const fields = readFileSync(
    new URL("../../../../contracts/l3/world-native/tests/fixtures/oath-stamina.txt", import.meta.url),
    "utf8",
  )
    .trim()
    .split(/\s+/)
    .map(Number);
  expect(fields).toHaveLength(112);
  const rules = { stamina_initial: 0, stamina_knight_max: 1_000, stamina_gain_per_tick: 1 } as never;
  while (fields.length) {
    const [held, attackBase, attack, exploreBase, explore, bonus, regen, hour] = fields.splice(0, 8) as number[];
    expect(oathAttackStamina(held!, attackBase!)).toBe(attack);
    expect(oathExploreStamina(held!, exploreBase!)).toBe(explore);
    expect(oathStaminaBonus(held!)).toBe(bonus);
    expect(oathRegenBps(held!)).toBe(regen);
    const troops = {
      category: TroopType.Knight,
      tier: TroopTier.T1,
      count: 1n,
      stamina: { amount: 0n, settled_at: 1_000, remainder: 0 },
      boosts: { incr_stamina_regen_percent_num: 0, incr_stamina_regen_seconds_left: 0 },
      battle_cooldown_end: 0,
      staminaMax: 1_000,
      staminaEffects: { until: Infinity, windows: [{ start: 1_000, end: 4_600, rateBps: oathRegenBps(held!) }] },
    } as never;
    expect(staminaAt(troops, 4_600, rules, 120).amount).toBe(BigInt(hour!));
  }
});

it("matches the native fight vectors for Skill, Fury and Perfection", async () => {
  const { readFileSync } = await import("node:fs");
  const { isCleanWin, oathFuryRefund, oathSitePay, oathSkillMultiplier } = await import("./oaths");
  const fields = readFileSync(
    new URL("../../../../contracts/l3/world-native/tests/fixtures/oath-fight.txt", import.meta.url),
    "utf8",
  )
    .trim()
    .split(/\s+/)
    .map(BigInt);
  expect(fields).toHaveLength(140);
  while (fields.length) {
    const [held, bar, skill, cost, refund, before, after, clean, amount, pay] = fields.splice(0, 10) as bigint[];
    expect(oathSkillMultiplier(Number(held), bar!).mag).toBe(skill);
    expect(oathFuryRefund(Number(held), Number(cost))).toBe(Number(refund));
    expect(isCleanWin(before!, after!)).toBe(clean === 1n);
    expect(oathSitePay(Number(held), amount!, clean === 1n)).toBe(pay);
  }
});

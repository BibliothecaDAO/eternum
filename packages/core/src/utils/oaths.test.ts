import { orders } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";
import { nativeOathConstants as oaths, type NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import { chooseOath, heldOaths, oathCards, oathColours } from "./oaths";

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
  it("partitions the sixteen Orders and reads the three actual cards", () => {
    expect(oathColours.map(({ mask }) => heldOaths(mask).length)).toEqual([6, 5, 5]);
    expect(oathColours.reduce((mask, colour) => mask | colour.mask, 0)).toBe(65535);
    expect(oathCards(pick)).toEqual([oaths.POWER, oaths.FOX, oaths.RAGE]);
    expect(oathCards(0)).toEqual([]);
    expect(() => oathCards(1)).toThrow("wrong colour");
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

it("refills 40% of the maximum at a well, 80% with Reflection, as the native vectors say", async () => {
  const { readFileSync } = await import("node:fs");
  const { oathWellStamina } = await import("./oaths");
  expect(oathWellStamina(0, 180)).toBe(72);
  expect(oathWellStamina(1 << (oaths.REFLECTION - 1), 180)).toBe(144);
  const fields = readFileSync(
    new URL("../../../../contracts/l3/world-native/tests/fixtures/oath-well-stamina.txt", import.meta.url),
    "utf8",
  )
    .trim()
    .split(/\s+/)
    .map(Number);
  expect(fields).toHaveLength(24);
  for (let i = 0; i < fields.length; i += 3) {
    expect(oathWellStamina(fields[i]!, fields[i + 1]!)).toBe(fields[i + 2]!);
  }
});

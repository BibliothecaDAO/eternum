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
    const names = Object.entries(oaths).filter(([name]) => !["RED", "BLUE", "GOLD"].includes(name));
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

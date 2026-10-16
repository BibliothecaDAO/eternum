import { ResourcesIds, type Structure, StructureType } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";
import {
  donkeysFor,
  donkeysNeeded,
  evenSplit,
  honouredShares,
  plansOf,
  prefillTotals,
  roleOf,
  sharesOf,
  wholeUnits,
  withoutShare,
  withShare,
  withTotal,
} from "./transfer-plan";

const realmGoods = [
  { resource: ResourcesIds.Wheat, have: 12_000, weightKg: 0.1 },
  { resource: ResourcesIds.Donkey, have: 240, weightKg: 0 },
];
const riftGoods = [{ resource: ResourcesIds.Essence, have: 4_000, weightKg: 0.1 }];
const campGoods = [
  { resource: ResourcesIds.Wheat, have: 500, weightKg: 0.1 },
  { resource: ResourcesIds.Labor, have: 5_000, weightKg: 0 },
];
const CAPACITY_KG = 50;
const A = 101;
const B = 102;
const C = 103;

/** A holding as the fact view lists it: only its kind and, for a mine, what it presents as matter here. */
const holding = (category: StructureType, mineKind = 0) =>
  ({ category, structure: { base: { category }, metadata: { mine_kind: mineKind } } }) as unknown as Structure;

describe("a holding's role in the prefill rules", () => {
  it("tells realms, camps and Essence Rifts from every other holding", () => {
    expect(roleOf(holding(StructureType.Realm))).toBe("realm");
    expect(roleOf(holding(StructureType.Camp))).toBe("camp");
    expect(roleOf(holding(StructureType.Mine, 1))).toBe("rift");
    expect(roleOf(holding(StructureType.Mine, 0))).toBe("other");
    expect(roleOf(holding(StructureType.Village))).toBe("other");
    expect(roleOf(undefined)).toBe("other");
  });
});

describe("a transfer's prefill (the owner's rules)", () => {
  it("opens at 0 unless the ends are one of the owner's pairs", () => {
    expect(prefillTotals("realm", ["realm"], realmGoods, CAPACITY_KG)).toEqual(new Map());
    expect(prefillTotals("rift", ["realm", "camp"], riftGoods, CAPACITY_KG)).toEqual(new Map());
    expect(prefillTotals("realm", [], realmGoods, CAPACITY_KG)).toEqual(new Map());
  });

  it("sends each rift 200 donkeys from a realm, as far as the realm has them", () => {
    expect(prefillTotals("realm", ["rift"], realmGoods, CAPACITY_KG)).toEqual(new Map([[ResourcesIds.Donkey, 200]]));
    expect(prefillTotals("realm", ["rift", "rift"], realmGoods, CAPACITY_KG)).toEqual(
      new Map([[ResourcesIds.Donkey, 240]]),
    );
  });

  it("sends all of a rift's Essence and all of a camp's goods to realms", () => {
    expect(prefillTotals("rift", ["realm", "realm"], riftGoods, CAPACITY_KG)).toEqual(
      new Map([[ResourcesIds.Essence, 4_000]]),
    );
    expect(prefillTotals("camp", ["realm"], campGoods, CAPACITY_KG)).toEqual(
      new Map([
        [ResourcesIds.Wheat, 500],
        [ResourcesIds.Labor, 5_000],
      ]),
    );
  });

  it("keeps home the donkeys a camp's goods need, and sends the rest", () => {
    // 500 wheat at 0.1 kg is 50 kg: one donkey for one realm, two for two (each realm's load is its own).
    const camp = [...campGoods, { resource: ResourcesIds.Donkey, have: 10, weightKg: 0 }];
    expect(prefillTotals("camp", ["realm"], camp, CAPACITY_KG).get(ResourcesIds.Donkey)).toBe(9);
    const toTwo = prefillTotals("camp", ["realm", "realm"], camp, CAPACITY_KG);
    expect(toTwo.get(ResourcesIds.Donkey)).toBe(8);
    expect(donkeysNeeded(plansOf(toTwo), camp, [A, B], CAPACITY_KG)).toBe(10);
  });
});

describe("a good's total, shared by its destinations", () => {
  const essence = plansOf(new Map([[ResourcesIds.Essence, 4_000]])).get(ResourcesIds.Essence)!;
  const HAVE = 4_000;
  const sent = (plan: Parameters<typeof sharesOf>[0], ids: number[], have = HAVE) =>
    sharesOf(plan, ids, have).reduce((total, share) => total + share, 0);

  it("splits evenly in whole units, every unit of the total going to a destination", () => {
    expect(sharesOf(essence, [A], HAVE)).toEqual([4_000]);
    expect(sharesOf(essence, [A, B, C], HAVE)).toEqual([1_334, 1_333, 1_333]);
    expect(sent(essence, [A, B, C])).toBe(4_000);
    expect(sharesOf(essence, [A, C], HAVE)).toEqual([2_000, 2_000]);
    expect(sharesOf(undefined, [A, B], HAVE)).toEqual([0, 0]);
    expect(evenSplit(10, 3)).toEqual([4, 3, 3]);
  });

  it("keeps a share set by hand and splits the rest among the others", () => {
    const pinned = withShare(essence, B, 3_000, HAVE, [A, B, C]);
    expect(sharesOf(pinned, [A, B, C], HAVE)).toEqual([500, 3_000, 500]);
    expect(sharesOf(withoutShare(pinned, B), [A, B, C], HAVE)).toEqual([1_334, 1_333, 1_333]);
  });

  it("never sends more than the total shown: lowering it below a hand-set share returns to the even split", () => {
    const pinnedAt80 = withShare(withTotal(undefined, 100, 100), A, 80, 100, [A, B]);
    expect(sharesOf(pinnedAt80, [A, B], 100)).toEqual([80, 20]);
    const lowered = withTotal(pinnedAt80, 10, 100);
    expect(lowered.total).toBe(10);
    expect(sharesOf(lowered, [A, B], 100)).toEqual([5, 5]);
  });

  it("drops a hand-set share that no longer fits when a destination goes, and keeps it when it comes back", () => {
    const pinned = withShare(withTotal(undefined, 100, 100), A, 80, 100, [A, B]);
    // A alone: its hand-set 80 would leave 20 of the total shown unsent, so the whole total goes to it.
    expect(sharesOf(pinned, [A], 100)).toEqual([100]);
    expect(honouredShares(pinned, [A], 100).size).toBe(0);
    expect(sharesOf(pinned, [A, B], 100)).toEqual([80, 20]);
  });

  it("sends no more than the source holds when its balance falls", () => {
    const plan = withShare(withTotal(undefined, 100, 100), A, 80, 100, [A, B]);
    expect(sharesOf(plan, [A, B], 50)).toEqual([25, 25]);
    expect(sent(plan, [A, B], 50)).toBe(50);
  });

  it("takes only whole units, so a fraction or a blank never reaches the chain", () => {
    expect(wholeUnits(1.5)).toBe(1);
    expect(wholeUnits(Number(""))).toBe(0);
    expect(wholeUnits(Number("abc"))).toBe(0);
    expect(wholeUnits(-3)).toBe(0);
    const fraction = withShare(withTotal(undefined, 10.7, 100), A, 1.5, 100, [A, B]);
    expect(sharesOf(fraction, [A, B], 100)).toEqual([1, 9]);
  });

  it("makes the total the hand-set shares' sum once every destination has one", () => {
    const both = withShare(withShare(withTotal(undefined, 10, 100), A, 30, 100, [A, B]), B, 5, 100, [A, B]);
    expect(both.total).toBe(35);
    expect(sharesOf(both, [A, B], 100)).toEqual([30, 5]);
  });

  it("never sets by hand more than the source holds, and grows the total to cover it", () => {
    const tooMuch = withShare(withShare(essence, A, 3_500, HAVE, [A, B, C]), B, 3_500, HAVE, [A, B, C]);
    expect(sharesOf(tooMuch, [A, B, C], HAVE)).toEqual([3_500, 500, 0]);
    const small = withTotal(undefined, 100, HAVE);
    expect(withShare(small, A, 300, HAVE, [A, B]).total).toBe(300);
    expect(withTotal(small, 9_000, HAVE).total).toBe(4_000);
  });
});

describe("a transfer's donkeys", () => {
  it("takes donkeys for each destination's load", () => {
    const plans = plansOf(new Map([[ResourcesIds.Essence, 4_000]]));
    expect(donkeysNeeded(plans, riftGoods, [A], CAPACITY_KG)).toBe(8);
    expect(donkeysNeeded(plans, riftGoods, [A, B, C], CAPACITY_KG)).toBe(9);
    expect(donkeysFor(0, CAPACITY_KG)).toBe(0);
  });

  it("counts the donkeys sent as goods beside those that carry", () => {
    const goods = [
      { resource: ResourcesIds.Wheat, have: 100, weightKg: 1 },
      { resource: ResourcesIds.Donkey, have: 10, weightKg: 0 },
    ];
    const plans = plansOf(
      new Map([
        [ResourcesIds.Wheat, 100],
        [ResourcesIds.Donkey, 10],
      ]),
    );
    // 100 kg takes 2 carrying donkeys beside the 10 sent: 12, more than the 10 held.
    expect(donkeysNeeded(plans, goods, [A], CAPACITY_KG)).toBe(12);
    // Two destinations: 50 kg each, one carrier each, and the 10 donkeys sent.
    expect(donkeysNeeded(plans, goods, [A, B], CAPACITY_KG)).toBe(12);
  });
});

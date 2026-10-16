import { ResourcesIds, type Structure, StructureType } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";
import {
  donkeysFor,
  donkeysTaken,
  evenSplit,
  plansOf,
  prefillTotals,
  roleOf,
  sharesOf,
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
    expect(prefillTotals("realm", ["realm"], realmGoods)).toEqual(new Map());
    expect(prefillTotals("rift", ["realm", "camp"], riftGoods)).toEqual(new Map());
    expect(prefillTotals("realm", [], realmGoods)).toEqual(new Map());
  });

  it("sends each rift 200 donkeys from a realm, as far as the realm has them", () => {
    expect(prefillTotals("realm", ["rift"], realmGoods)).toEqual(new Map([[ResourcesIds.Donkey, 200]]));
    expect(prefillTotals("realm", ["rift", "rift"], realmGoods)).toEqual(new Map([[ResourcesIds.Donkey, 240]]));
  });

  it("sends all of a rift's Essence and all of a camp's goods to realms", () => {
    expect(prefillTotals("rift", ["realm", "realm"], riftGoods)).toEqual(new Map([[ResourcesIds.Essence, 4_000]]));
    expect(prefillTotals("camp", ["realm"], campGoods)).toEqual(
      new Map([
        [ResourcesIds.Wheat, 500],
        [ResourcesIds.Labor, 5_000],
      ]),
    );
  });
});

describe("a good's total, shared by its destinations", () => {
  const essence = plansOf(new Map([[ResourcesIds.Essence, 4_000]])).get(ResourcesIds.Essence)!;

  it("splits evenly, and splits again when destinations come and go", () => {
    expect(sharesOf(essence, [A])).toEqual([4_000]);
    expect(sharesOf(essence, [A, B, C])).toEqual([1_333, 1_333, 1_333]);
    expect(sharesOf(essence, [A, C])).toEqual([2_000, 2_000]);
    expect(sharesOf(undefined, [A, B])).toEqual([0, 0]);
  });

  it("keeps a share set by hand and splits the rest among the others", () => {
    const pinned = withShare(essence, B, 3_000, 4_000, [A, B, C]);
    expect(sharesOf(pinned, [A, B, C])).toEqual([500, 3_000, 500]);
    expect(sharesOf(withoutShare(pinned, B), [A, B, C])).toEqual([1_333, 1_333, 1_333]);
  });

  it("never sets by hand more than the source holds, and grows the total to cover it", () => {
    const tooMuch = withShare(withShare(essence, A, 3_500, 4_000, [A, B]), B, 3_500, 4_000, [A, B]);
    expect(sharesOf(tooMuch, [A, B])).toEqual([3_500, 500]);
    const small = withTotal(undefined, 100, 4_000);
    expect(withShare(small, A, 300, 4_000, [A, B]).total).toBe(300);
    expect(withTotal(small, 9_000, 4_000).total).toBe(4_000);
  });
});

describe("a transfer's donkeys", () => {
  it("takes donkeys for each destination's load", () => {
    const plans = plansOf(new Map([[ResourcesIds.Essence, 4_000]]));
    expect(donkeysTaken(plans, riftGoods, [A], 50)).toBe(8);
    expect(donkeysTaken(plans, riftGoods, [A, B, C], 50)).toBe(9);
    expect(evenSplit(10, 3)).toEqual([3, 3, 3]);
    expect(donkeysFor(0, 50)).toBe(0);
  });
});

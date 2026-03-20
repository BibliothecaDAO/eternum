import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@bibliothecadao/types", () => ({
  TroopType: {
    Knight: "Knight",
    Crossbowman: "Crossbowman",
    Paladin: "Paladin",
  },
  TroopTier: {
    T1: "T1",
    T2: "T2",
    T3: "T3",
  },
  StructureType: {
    1: "Realm",
    Realm: 1,
  },
}));

vi.mock("@/three/constants/scene-constants", () => ({
  getStructureModelPaths: () => ({
    1: ["structures/realm.glb"],
  }),
}));

import { resolveEligibleCosmeticIds } from "../ownership";
import { clearRegistry, seedDefaultCosmetics } from "../registry";

describe("resolveEligibleCosmeticIds", () => {
  beforeEach(() => {
    clearRegistry();
    seedDefaultCosmetics({ force: true });
  });

  it("maps a known ownership attr to an eligible army cosmetic", () => {
    expect(resolveEligibleCosmeticIds(["0x107050201"])).toContain("army:Knight:T3:legacy");
  });

  it("maps a known ownership attr to an eligible attachment", () => {
    expect(resolveEligibleCosmeticIds(["0x4050301"])).toContain("attachment:army:aura-legacy");
  });

  it("ignores unknown attrs safely", () => {
    expect(resolveEligibleCosmeticIds(["0xdeadbeef"])).toEqual([]);
  });

  it("normalizes duplicate attrs deterministically", () => {
    expect(resolveEligibleCosmeticIds(["0x04050301", "4050301", "0x4050301"])).toEqual(["attachment:army:aura-legacy"]);
  });
});

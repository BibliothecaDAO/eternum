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

vi.mock("../debug-controller", () => ({
  cosmeticDebugController: {
    resolveOverride: () => undefined,
  },
}));

vi.mock("../asset-cache", () => ({
  ensureCosmeticAsset: () => undefined,
}));

import { ModelType } from "../../types/army";
import { StructureType, TroopTier, TroopType } from "@bibliothecadao/types";
import { clearRegistry, seedDefaultCosmetics } from "../registry";
import { resolveArmyCosmetic, resolveStructureCosmetic } from "../resolver";

describe("cosmetic pipeline integration", () => {
  beforeEach(() => {
    clearRegistry();
    seedDefaultCosmetics({ force: true });
  });

  it("resolves every army and structure to its default skin", () => {
    const army = resolveArmyCosmetic({
      owner: "0x0",
      troopType: TroopType.Knight,
      tier: TroopTier.T1,
      defaultModelType: ModelType.Knight1,
    });
    const structure = resolveStructureCosmetic({
      owner: "0x0",
      structureType: StructureType.Realm,
      defaultModelKey: "Realm",
    });

    expect(army.skin.isFallback).toBe(true);
    expect(structure.skin.isFallback).toBe(true);
  });
});

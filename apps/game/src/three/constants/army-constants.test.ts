// @vitest-environment node

import { describe, expect, it } from "vitest";

import { TroopTier, TroopType } from "@bibliothecadao/types";
import { buildArmyModelAssetPath, isShipModel, TROOP_TO_MODEL, TROOP_TO_SHIP_MODEL } from "./army-constants";
import { ModelType } from "../types/army";

describe("buildArmyModelAssetPath", () => {
  it("uses an absolute models path so nested play routes do not fetch the HTML app shell", () => {
    expect(buildArmyModelAssetPath(ModelType.Knight1)).toBe("/models/units/default_knight_lvl1.glb");
    expect(buildArmyModelAssetPath(ModelType.Paladin1)).toBe("/models/units/default_paladin_lvl1.glb");
    expect(buildArmyModelAssetPath(ModelType.ShipCrossbowman2)).toBe("/models/ships/crossbowman-t2.glb");
  });
});

describe("ship models", () => {
  it("gives every troop class and tier its own hull", () => {
    const hulls = new Set<ModelType>();
    for (const troopType of [TroopType.Knight, TroopType.Crossbowman, TroopType.Paladin]) {
      for (const tier of [TroopTier.T1, TroopTier.T2, TroopTier.T3]) {
        const hull = TROOP_TO_SHIP_MODEL[troopType][tier];
        expect(isShipModel(hull)).toBe(true);
        expect(isShipModel(TROOP_TO_MODEL[troopType][tier])).toBe(false);
        hulls.add(hull);
      }
    }
    expect(hulls.size).toBe(9);
  });

  it("treats a missing model as land so a bare army never grounds like a hull", () => {
    expect(isShipModel(undefined)).toBe(false);
  });
});

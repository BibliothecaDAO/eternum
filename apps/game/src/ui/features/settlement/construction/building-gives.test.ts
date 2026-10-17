import { BuildingType, ResourcesIds, StructureType } from "@bibliothecadao/types";
import { describe, expect, it } from "vitest";

import { describeBuildingGives, describeCostLine } from "./building-gives";

/** A store holding Wheat's rule: 6 a second on a realm, 3 on a village, at the contract's precision. */
const store = {
  require: (model: string, keys: { resource_type?: number }) => {
    if (model === "ResourceRule" && keys.resource_type === ResourcesIds.Wheat)
      return { realm_rate: 6_000_000_000n, village_rate: 3_000_000_000n };
    throw new Error(`${model} not synchronized`);
  },
} as never;
const realm = { game_id: 1, base: { category: StructureType.Realm } } as never;
const village = { game_id: 1, base: { category: StructureType.Village } } as never;

describe("what a building gives, on its Build card", () => {
  it("names a producer's output per minute, from its structure's rate", () => {
    expect(describeBuildingGives(store, realm, BuildingType.ResourceWheat, 0)).toBe("+360 Wheat / min");
    expect(describeBuildingGives(store, village, BuildingType.ResourceWheat, 0)).toBe("+180 Wheat / min");
  });

  it("names a hut's population cap, and nothing for a building that gives neither", () => {
    expect(describeBuildingGives(store, realm, BuildingType.WorkersHut, 6)).toBe("+6 population cap");
    expect(describeBuildingGives(store, realm, BuildingType.WorkersHut, 0)).toBeNull();
  });
});

describe("a building's cost, on its Build card", () => {
  it("reads as an amount of a named resource and what is held", () => {
    expect(describeCostLine(ResourcesIds.Labor, 10, 1_574.6)).toBe("10 Labor (you have 1,574)");
    expect(describeCostLine(ResourcesIds.Wood, 1_200, undefined)).toBe("1,200 Wood");
  });
});

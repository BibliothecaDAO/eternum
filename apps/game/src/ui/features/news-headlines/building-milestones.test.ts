import { BuildingType } from "@bibliothecadao/types";
import { expect, it } from "vitest";
import { createBuildingMilestones } from "./building-milestones";
const barracks = (structure: bigint) => ({ structure_id: structure, category: BuildingType.ResourceKnightT3 });
it("fires once per structure, including a second structure, regardless of deployments or building count", () => {
  const observe = createBuildingMilestones([]);
  expect(observe(barracks(10n), true)).toBe("Barracks");
  expect(observe(barracks(10n), true)).toBeNull();
  expect(observe({ ...barracks(10n), category: BuildingType.ResourcePaladinT3 }, true)).toBeNull();
  expect(observe(barracks(20n), true)).toBe("Barracks");
});
it("marks snapshot and replay buildings seen without firing", () => {
  const observe = createBuildingMilestones([barracks(10n)]);
  expect(observe(barracks(10n), true)).toBeNull();
  expect(observe(barracks(20n), false)).toBeNull();
  expect(observe(barracks(20n), true)).toBeNull();
  expect(observe(barracks(30n), true)).toBe("Barracks");
});
it("ignores T2 and names each T3 building", () => {
  const observe = createBuildingMilestones([]);
  expect(observe({ structure_id: 1n, category: BuildingType.ResourceKnightT2 }, true)).toBeNull();
  expect(observe({ structure_id: 1n, category: BuildingType.ResourceCrossbowmanT3 }, true)).toBe("Archery Range");
  expect(observe({ structure_id: 2n, category: BuildingType.ResourcePaladinT3 }, true)).toBe("Stables");
});

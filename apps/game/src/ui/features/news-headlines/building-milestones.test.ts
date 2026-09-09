import { readFileSync } from "node:fs";
import { BuildingType } from "@bibliothecadao/types";
import { expect, it } from "vitest";
import { createBuildingMilestones } from "./building-milestones";
const barracks = (structure: number) => ({ outer_entity_id: structure, category: BuildingType.ResourceKnightT3 });
it("fires once per structure, including a second structure, regardless of deployments or building count", () => {
  const observe = createBuildingMilestones([]);
  expect(observe(barracks(10), true)).toBe("Barracks");
  expect(observe(barracks(10), true)).toBeNull();
  expect(observe({ ...barracks(10), category: BuildingType.ResourcePaladinT3 }, true)).toBeNull();
  expect(observe(barracks(20), true)).toBe("Barracks");
});
it("marks snapshot and replay buildings seen without firing", () => {
  const observe = createBuildingMilestones([barracks(10)]);
  expect(observe(barracks(10), true)).toBeNull();
  expect(observe(barracks(20), false)).toBeNull();
  expect(observe(barracks(20), true)).toBeNull();
  expect(observe(barracks(30), true)).toBe("Barracks");
});
it("ignores T2 and names each T3 building", () => {
  const observe = createBuildingMilestones([]);
  expect(observe({ outer_entity_id: 1, category: BuildingType.ResourceKnightT2 }, true)).toBeNull();
  expect(observe({ outer_entity_id: 1, category: BuildingType.ResourceCrossbowmanT3 }, true)).toBe("Archery Range");
  expect(observe({ outer_entity_id: 2, category: BuildingType.ResourcePaladinT3 }, true)).toBe("Stables");
});
it("has no story subscription that can turn T3 army creation into a headline", () => {
  const bridge = readFileSync("src/ui/features/news-headlines/news-headline-bridge.tsx", "utf8");
  expect(bridge).not.toMatch(/ExplorerCreateStory|useStoryEvents|parseTroopTier|firstT2|firstT3/);
  expect(bridge).toContain("setup.components.Building.update$.subscribe");
  expect(bridge).toContain('getStatus() === "running"');
});

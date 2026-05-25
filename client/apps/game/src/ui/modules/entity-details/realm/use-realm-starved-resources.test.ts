// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ResourcesIds } from "@bibliothecadao/types";
import { extractStarvedResources } from "./use-realm-starved-resources";
import type { RealmAutomationExecutionSummary } from "@/hooks/store/use-automation-store";

const baseSummary = (overrides?: Partial<RealmAutomationExecutionSummary>): RealmAutomationExecutionSummary => ({
  executedAt: Date.now(),
  resourceToResource: [],
  laborToResource: [],
  consumptionByResource: {},
  outputsByResource: {},
  skipped: [],
  skippedByResource: {},
  ...overrides,
});

describe("extractStarvedResources", () => {
  it("returns an empty map when last execution is undefined", () => {
    const result = extractStarvedResources(undefined);
    expect(result.size).toBe(0);
  });

  it("prefers skippedByResource when populated", () => {
    const summary = baseSummary({
      skippedByResource: {
        [ResourcesIds.Knight]: "Insufficient complex recipe inputs",
        [ResourcesIds.Paladin]: "No active production building",
      },
      skipped: [],
    });
    const result = extractStarvedResources(summary);
    expect(result.size).toBe(2);
    expect(result.get(ResourcesIds.Knight)).toMatch(/waiting for recipe inputs/);
    expect(result.get(ResourcesIds.Paladin)).toMatch(/has no active production building/);
  });

  it("falls back to the skipped array for legacy summaries without skippedByResource", () => {
    const summary = baseSummary({
      skippedByResource: {},
      skipped: [
        { resourceId: ResourcesIds.Knight, reason: "Insufficient labor recipe inputs" },
        { resourceId: ResourcesIds.Paladin, reason: "Missing complex recipe configuration" },
      ],
    });
    const result = extractStarvedResources(summary);
    expect(result.size).toBe(2);
    expect(result.get(ResourcesIds.Knight)).toMatch(/waiting for labor inputs/);
    expect(result.get(ResourcesIds.Paladin)).toMatch(/missing resource recipe/);
  });

  it("keeps the first skip reason when a resource appears multiple times in skipped", () => {
    const summary = baseSummary({
      skippedByResource: {},
      skipped: [
        { resourceId: ResourcesIds.Knight, reason: "Insufficient complex recipe inputs" },
        { resourceId: ResourcesIds.Knight, reason: "Insufficient labor recipe inputs" },
      ],
    });
    const result = extractStarvedResources(summary);
    expect(result.size).toBe(1);
    expect(result.get(ResourcesIds.Knight)).toMatch(/waiting for recipe inputs/);
  });

  it("returns empty map when both skippedByResource and skipped are empty", () => {
    const summary = baseSummary();
    const result = extractStarvedResources(summary);
    expect(result.size).toBe(0);
  });
});

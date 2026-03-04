// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { isBuildPendingForStructureType } from "./select-preview-building.pending-policy";

const BUILDING_TYPE_WHEAT = 1;
const BUILDING_TYPE_FISH = 2;

describe("isBuildPendingForStructureType", () => {
  it("returns true when local pending map already marks the building type", () => {
    const getPendingCountForStructureAndType = vi.fn(() => 0);

    const result = isBuildPendingForStructureType({
      entityId: 101,
      buildingType: BUILDING_TYPE_WHEAT,
      localPendingByTypeKey: {
        [BUILDING_TYPE_WHEAT.toString()]: true,
      },
      getPendingCountForStructureAndType,
    });

    expect(result).toBe(true);
    expect(getPendingCountForStructureAndType).not.toHaveBeenCalled();
  });

  it("falls back to core optimistic pending selector for continuity", () => {
    const getPendingCountForStructureAndType = vi.fn((entityId: number, buildingType: number) => {
      if (entityId === 202 && buildingType === BUILDING_TYPE_FISH) {
        return 1;
      }
      return 0;
    });

    const result = isBuildPendingForStructureType({
      entityId: 202,
      buildingType: BUILDING_TYPE_FISH,
      localPendingByTypeKey: {},
      getPendingCountForStructureAndType,
    });

    expect(result).toBe(true);
    expect(getPendingCountForStructureAndType).toHaveBeenCalledWith(202, BUILDING_TYPE_FISH);
  });

  it("keeps pending state structure-scoped", () => {
    const getPendingCountForStructureAndType = vi.fn((entityId: number) => (entityId === 303 ? 1 : 0));

    const result = isBuildPendingForStructureType({
      entityId: 404,
      buildingType: BUILDING_TYPE_WHEAT,
      localPendingByTypeKey: {},
      getPendingCountForStructureAndType,
    });

    expect(result).toBe(false);
  });
});

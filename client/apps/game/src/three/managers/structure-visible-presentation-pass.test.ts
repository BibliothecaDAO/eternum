import { describe, expect, it, vi } from "vitest";

const { presentVisibleStructures } = await import("./structure-visible-presentation-pass");

describe("presentVisibleStructures", () => {
  it("presents every visible structure and returns the retained entity ids", () => {
    const presentStructure = vi.fn();
    const visibleStructureIds = presentVisibleStructures({
      visibleStructures: [
        { entityId: 11, structureType: "HolySite" },
        { entityId: 12, structureType: "Village" },
      ],
      presentStructure,
    });

    expect(presentStructure).toHaveBeenCalledTimes(2);
    expect(presentStructure).toHaveBeenNthCalledWith(1, { entityId: 11, structureType: "HolySite" });
    expect(presentStructure).toHaveBeenNthCalledWith(2, { entityId: 12, structureType: "Village" });
    expect(visibleStructureIds).toEqual(new Set([11, 12]));
  });
});

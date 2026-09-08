// @vitest-environment node

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./bottom-right-panel.tsx", import.meta.url), "utf8");

describe("local tile state ownership", () => {
  it("subscribes to selected building, structure, resources, and building occupancy", () => {
    expect(source).toMatch(/useComponentValue\(\s*buildingComponent,/);
    for (const component of ["Structure", "Resource", "StructureBuildings"]) {
      expect(source).toContain(`useComponentValue(setup.components.${component}, structureKey)`);
    }
    expect(source).not.toContain("getComponentValue");
    expect(source).not.toContain("setIsPaused");
    expect(source).not.toContain("const buildCost = useMemo");
  });

  it("renders building production and castle labor inline without a catalogue trigger", () => {
    const local = source.slice(source.indexOf("const LocalTilePanel"), source.indexOf("const MinimapPanel"));
    expect(local).toContain("resource={ResourcesIds.Labor}");
    expect(local).toContain("resource={producedResource}");
    expect(local).not.toContain("openSurface");
    expect(local).not.toContain("ProductionModal");
  });

  it("guards production and destruction against spectator intent even for an owned realm", () => {
    expect(source).toContain("!isSpectating");
    expect(source).toContain("useUIStore(canIssueOrders)");
    expect(
      source.match(/if \(!selectedBuildingHex \|\| !canManageBuilding \|\| isActionLoading\) return;/g),
    ).toHaveLength(2);
  });
});

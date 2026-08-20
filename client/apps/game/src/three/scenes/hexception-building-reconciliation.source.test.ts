import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./hexception.tsx", import.meta.url), "utf8");

describe("HexceptionScene building reconciliation wiring", () => {
  it("routes subscribed building updates through the targeted reconciler", () => {
    expect(source).toContain("(update: BuildingSystemUpdate) => this.handleBuildingUpdate(update, realmGeneration)");
    expect(source).toContain("this.applyTargetedBuildingReconciliation(reconciliation, realmGeneration)");
    expect(source).toContain("applyFullFallback: () => this.updateHexceptionGrid(this.hexceptionRadius)");
  });

  it("owns delayed building work by the active realm generation", () => {
    const targetedStart = source.indexOf("private applyTargetedBuildingReconciliation");
    const targetedEnd = source.indexOf("private advanceRealmGeneration", targetedStart);
    const targetedSource = source.slice(targetedStart, targetedEnd);
    const gridStart = source.indexOf("updateHexceptionGrid(radius: number)");
    const gridEnd = source.indexOf("private reconcileAllBuildingInstances", gridStart);
    const gridSource = source.slice(gridStart, gridEnd);

    expect(source).toContain("const realmGeneration = this.advanceRealmGeneration()");
    expect(source.match(/this\.advanceRealmGeneration\(\)/g)).toHaveLength(2);
    expect(targetedSource).toContain("isOwned: () => this.ownsRealmGeneration(realmGeneration)");
    expect(targetedSource).toContain("this.updateBuildingHighlight(reconciliation.position, Boolean(latestBuilding))");
    expect(gridSource).toContain("isOwned: () => this.ownsRealmGeneration(realmGeneration)");
  });

  it("keeps buildable terrain independent of occupancy in clean grid builds", () => {
    const buildableTilesStart = source.indexOf("buildablePositions.forEach((position) => {");
    const outerTerrainStart = source.indexOf("positions.forEach((position) => {", buildableTilesStart);
    const buildableTilesSource = source.slice(buildableTilesStart, outerTerrainStart);

    expect(buildableTilesStart).toBeGreaterThan(-1);
    expect(outerTerrainStart).toBeGreaterThan(buildableTilesStart);
    expect(buildableTilesSource).not.toContain("let withBuilding = false");
    expect(buildableTilesSource).toMatch(
      /if \(building\)[\s\S]*?this\.buildings\.push[\s\S]*?else \{[\s\S]*?this\.highlights\.push[\s\S]*?\}\s+const tempMatrix/,
    );
  });

  it("refreshes active placement highlights after a targeted occupancy change", () => {
    const updateHighlightStart = source.indexOf("private updateBuildingHighlight");
    const renderHighlightsStart = source.indexOf("private renderBuildingPlacementHighlights", updateHighlightStart);
    const updateHighlightSource = source.slice(updateHighlightStart, renderHighlightsStart);

    expect(updateHighlightSource).toContain("this.buildingPreview?.getPreviewBuilding()");
    expect(updateHighlightSource).toContain("this.renderBuildingPlacementHighlights()");
  });

  it("does not request a full grid rebuild after a submitted placement", () => {
    const placementStart = source.indexOf("await this.tileManager.placeBuilding(");
    const placementEnd = source.indexOf("} else {", placementStart);
    const placementSource = source.slice(placementStart, placementEnd);

    expect(placementStart).toBeGreaterThan(-1);
    expect(placementEnd).toBeGreaterThan(placementStart);
    expect(placementSource).not.toContain("this.updateHexceptionGrid(");
  });
});

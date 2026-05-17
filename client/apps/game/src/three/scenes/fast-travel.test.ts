import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readFastTravelSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const scenePath = resolve(currentDir, "fast-travel.ts");
  return readFileSync(scenePath, "utf8");
}

describe("FastTravelScene lifecycle shell", () => {
  it("extends WarpTravel and routes switch-off through the shared lifecycle", () => {
    const source = readFastTravelSource();

    expect(source).toMatch(/extends WarpTravel/);
    expect(source).toMatch(/runWarpTravelSwitchOffLifecycle\(\)/);
  });

  it("routes destroy through switch-off before base teardown", () => {
    const source = readFastTravelSource();

    expect(source).toMatch(/public destroy\(\): void \{\s*this\.onSwitchOff\(\);[\s\S]*super\.destroy\(\);/);
  });

  it("defines named fast-travel lifecycle hooks instead of inline adapter lambdas", () => {
    const source = readFastTravelSource();

    expect(source).toMatch(/configureFastTravelSetupStart/);
    expect(source).toMatch(/prepareFastTravelInitialSetup/);
    expect(source).toMatch(/attachFastTravelLabelGroupsToScene/);
    expect(source).toMatch(/attachFastTravelManagerLabels/);
    expect(source).toMatch(/refreshFastTravelScene/);
    expect(source).toMatch(/reportFastTravelRefreshError/);
    expect(source).toMatch(/disposeFastTravelStoreSubscriptions/);
    expect(source).toMatch(/detachFastTravelManagerLabels/);
  });

  it("does not hydrate demo armies or spires", () => {
    const source = readFastTravelSource();

    expect(source).not.toMatch(/buildDemoArmies/);
    expect(source).not.toMatch(/buildDemoSpires/);
    expect(source).toMatch(/resolveFastTravelLayerState/);
  });

  it("blocks spire exits into allied world-layer armies before opening the travel modal", () => {
    const source = readFastTravelSource();

    const methodStart = source.indexOf("private openFastTravelSpireTravel(");
    expect(methodStart).toBeGreaterThan(-1);

    const methodBody = source.slice(methodStart, methodStart + 2600);
    expect(methodBody).toContain("isOpposingArmy: (targetArmyId) => this.canAttackSpireTraversalArmy");
    expect(methodBody).toContain('if (traversalAction.kind === "blocked")');
    expect(methodBody).toContain('toast.error("Another allied army already occupies the linked world tile.")');
  });

  it("hydrates visible ethereal structures before resolving allied ownership", () => {
    const source = readFastTravelSource();

    expect(source).toContain("collectVisibleFastTravelStructureIds");
    expect(source).toContain("const visibleStructureIds = this.collectVisibleFastTravelStructureIds(chunkPlan);");
    expect(source).toContain(
      "const structureIdsToHydrate = new Set<ID>([...ownerStructureIds, ...visibleStructureIds]);",
    );
    expect(source).toContain("[...structureIdsToHydrate]");
  });

  it("syncs the selected army hex into UI state before opening fast-travel combat previews", () => {
    const source = readFastTravelSource();

    expect(source).toContain("useUIStore.getState().setSelectedHex({ col: selectedHex.col, row: selectedHex.row });");
  });

  it("dispatches chest and help action paths through dedicated fast-travel handlers", () => {
    const source = readFastTravelSource();

    expect(source).toContain("if (actionType === ActionType.Help)");
    expect(source).toContain("this.openFastTravelHelp(actionPath, this.selectedArmyEntityId);");
    expect(source).toContain("if (actionType === ActionType.Chest)");
    expect(source).toContain("this.openFastTravelChest(actionPath, this.selectedArmyEntityId);");
  });

  it("uses structure attack previews when the ethereal target is a structure", () => {
    const source = readFastTravelSource();

    expect(source).toContain("const targetActorType = targetTile.occupier_is_structure");
    expect(source).toContain("? ActorType.Structure");
    expect(source).toContain(": ActorType.Explorer");
  });

  it("commits fast-travel actions from the primary click handler after selection", () => {
    const source = readFastTravelSource();

    const methodStart = source.indexOf("protected onHexagonClick(");
    expect(methodStart).toBeGreaterThan(-1);

    const methodEnd = source.indexOf("protected onHexagonRightClick(", methodStart);
    expect(methodEnd).toBeGreaterThan(methodStart);

    const methodBody = source.slice(methodStart, methodEnd);
    expect(methodBody).toContain("this.commitFastTravelMovement(hexCoords);");
  });

  it("checks paired world spire traversal occupancy at the ethereal army origin", () => {
    const source = readFastTravelSource();

    const methodStart = source.indexOf("private openFastTravelSpireTravel(");
    expect(methodStart).toBeGreaterThan(-1);

    const methodEnd = source.indexOf("private async syncPairedWorldSpireTile(", methodStart);
    expect(methodEnd).toBeGreaterThan(methodStart);

    const methodBody = source.slice(methodStart, methodEnd);
    expect(methodBody).toContain("const destinationHex = resolveSpireTraversalDestinationHex(actionPath);");
    expect(methodBody).toContain("getTileAt(this.dojo.components, false, destinationHex.col, destinationHex.row)");
    expect(methodBody).toContain("this.syncPairedWorldSpireTile(destinationHex)");
    expect(methodBody).toContain("targetHex: destinationHex");
  });

  it("navigates to the paired world destination after fast-travel spire traversal", () => {
    const source = readFastTravelSource();

    const methodStart = source.indexOf("private openFastTravelSpireTravel(");
    expect(methodStart).toBeGreaterThan(-1);

    const methodEnd = source.indexOf("private async syncPairedWorldSpireTile(", methodStart);
    expect(methodEnd).toBeGreaterThan(methodStart);

    const methodBody = source.slice(methodStart, methodEnd);
    expect(methodBody).toContain("destinationHex,");
    expect(methodBody).toContain('navigateToLayer: "world"');
  });

  it("passes the ethereal layer into chest actions opened from fast travel", () => {
    const source = readFastTravelSource();

    const methodStart = source.indexOf("private openFastTravelChest(");
    expect(methodStart).toBeGreaterThan(-1);

    const methodEnd = source.indexOf("private openFastTravelSpireTravel(", methodStart);
    expect(methodEnd).toBeGreaterThan(methodStart);

    const methodBody = source.slice(methodStart, methodEnd);
    expect(methodBody).toContain("chestAlt: true");
  });

  it("clears the previous selected army preview before switching selection", () => {
    const source = readFastTravelSource();

    const methodStart = source.indexOf("private selectFastTravelArmy(");
    expect(methodStart).toBeGreaterThan(-1);

    const methodEnd = source.indexOf("private refreshSelectedArmyActionPaths(", methodStart);
    expect(methodEnd).toBeGreaterThan(methodStart);

    const methodBody = source.slice(methodStart, methodEnd);
    expect(methodBody.indexOf("this.clearFastTravelMovementPreview();")).toBeLessThan(
      methodBody.indexOf("this.selectedArmyEntityId = selectedArmyId;"),
    );
  });

  it("converts ethereal tile biome ids into BiomeType values before action-path resolution", () => {
    const source = readFastTravelSource();

    const methodStart = source.indexOf("private resolveFastTravelLayerState(");
    expect(methodStart).toBeGreaterThan(-1);

    const methodEnd = source.indexOf("private applyFastTravelOccupierState(", methodStart);
    expect(methodEnd).toBeGreaterThan(methodStart);

    const methodBody = source.slice(methodStart, methodEnd);
    expect(methodBody).toContain("resolveFastTravelTileBiomeType(tile.biome)");
    expect(methodBody).not.toContain("Number(tile.biome) as unknown as BiomeType");
  });
});

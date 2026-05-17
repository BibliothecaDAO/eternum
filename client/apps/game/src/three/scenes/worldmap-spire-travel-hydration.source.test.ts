import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(filename: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, filename), "utf8");
}

describe("Worldmap spire travel hydration", () => {
  it("hydrates the ethereal tile before resolving spire traversal occupancy", () => {
    const source = readSource("worldmap.tsx");

    const methodStart = source.indexOf("private onArmySpireTravel(");
    expect(methodStart).toBeGreaterThan(-1);

    const methodBody = source.slice(methodStart, methodStart + 2600);
    expect(methodBody).toContain("syncEtherealSpireTraversalTile");
    expect(methodBody).toContain("hasSyncedEtherealTile");
    expect(methodBody).toContain(".then(() =>");
  });

  it("shows an error instead of traveling when the ethereal tile is still missing after sync", () => {
    const source = readSource("worldmap.tsx");

    const methodStart = source.indexOf("private onArmySpireTravel(");
    expect(methodStart).toBeGreaterThan(-1);

    const methodEnd = source.indexOf("private shouldSyncEtherealSpireTraversalTile(", methodStart);
    expect(methodEnd).toBeGreaterThan(methodStart);

    const methodBody = source.slice(methodStart, methodEnd);
    const syncedRetryIndex = methodBody.indexOf("hasSyncedEtherealTile");
    const missingTileGuardIndex = methodBody.indexOf("if (!etherealTile) {");
    const traversalIndex = methodBody.indexOf("const traversalAction = resolveSpireTraversalAction({");

    expect(syncedRetryIndex).toBeGreaterThan(-1);
    expect(missingTileGuardIndex).toBeGreaterThan(syncedRetryIndex);
    expect(traversalIndex).toBeGreaterThan(missingTileGuardIndex);
    expect(methodBody).toContain('toast.error("Unable to verify the linked ethereal tile right now.");');
  });

  it("checks the paired ethereal destination at the army origin instead of the adjacent spire", () => {
    const source = readSource("worldmap.tsx");

    const methodStart = source.indexOf("private onArmySpireTravel(");
    expect(methodStart).toBeGreaterThan(-1);

    const methodEnd = source.indexOf("private shouldSyncEtherealSpireTraversalTile(", methodStart);
    expect(methodEnd).toBeGreaterThan(methodStart);

    const methodBody = source.slice(methodStart, methodEnd);
    expect(methodBody).toContain("const destinationHex = resolveSpireTraversalDestinationHex(actionPath);");
    expect(methodBody).toContain("getTileAt(this.dojo.components, true, destinationHex.col, destinationHex.row)");
    expect(methodBody).toContain("this.syncEtherealSpireTraversalTile(destinationHex)");
    expect(methodBody).toContain("targetHex: destinationHex");
  });

  it("keeps the adjacent spire hex as the attack direction target", () => {
    const source = readSource("worldmap.tsx");

    const methodStart = source.indexOf("private onArmySpireTravel(");
    expect(methodStart).toBeGreaterThan(-1);

    const methodEnd = source.indexOf("private shouldSyncEtherealSpireTraversalTile(", methodStart);
    expect(methodEnd).toBeGreaterThan(methodStart);

    const methodBody = source.slice(methodStart, methodEnd);
    expect(methodBody).toContain("directionHex: { x: targetHex.col, y: targetHex.row }");
  });

  it("navigates to the paired ethereal army destination after world-layer spire travel", () => {
    const source = readSource("worldmap.tsx");

    const methodStart = source.indexOf("private onArmyMovement(");
    expect(methodStart).toBeGreaterThan(-1);

    const methodEnd = source.indexOf("private onArmyAttack(", methodStart);
    expect(methodEnd).toBeGreaterThan(methodStart);

    const methodBody = source.slice(methodStart, methodEnd);
    expect(methodBody).toContain("const navigationHex =");
    expect(methodBody).toContain("resolveSpireTraversalDestinationHex(actionPath)");
    expect(methodBody).toContain('navigateToStructure(navigationHex.col, navigationHex.row, "travel")');
  });

  it("uses the paired-layer destination for pending spire movement bookkeeping", () => {
    const source = readSource("worldmap.tsx");

    const methodStart = source.indexOf("private onArmyMovement(");
    expect(methodStart).toBeGreaterThan(-1);

    const methodEnd = source.indexOf("private onArmyAttack(", methodStart);
    expect(methodEnd).toBeGreaterThan(methodStart);

    const methodBody = source.slice(methodStart, methodEnd);
    expect(methodBody).toContain("const movementTargetHex = navigationHex ?? targetHex;");
    expect(methodBody).toContain("const key = this.resolveContractHexKey(movementTargetHex);");
    expect(methodBody).toContain(
      "const destPosition = new Position({ x: movementTargetHex.col, y: movementTargetHex.row });",
    );
  });
});

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readArmyManagerSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "army-manager.ts"), "utf8");
}

describe("army manager stamina sync wiring", () => {
  it("synchronizes tracked army state from tile updates before owner sync for existing armies", () => {
    const source = readArmyManagerSource();
    const methodStart = source.indexOf("async onTileUpdate(update: ExplorerTroopsTileSystemUpdate)");
    expect(methodStart).toBeGreaterThan(-1);

    const methodBody = source.slice(methodStart, methodStart + 2200);
    const syncIndex = methodBody.indexOf("this.syncTrackedArmyStateFromTileUpdate(update,");
    const ownerIndex = methodBody.indexOf("this.syncTrackedArmyOwnerState({");

    expect(syncIndex).toBeGreaterThan(-1);
    expect(ownerIndex).toBeGreaterThan(-1);
    expect(syncIndex).toBeLessThan(ownerIndex);
  });

  it("routes explorer troop updates through the stamina snapshot freshness gate", () => {
    const source = readArmyManagerSource();
    const methodStart = source.indexOf("public updateArmyFromExplorerTroopsUpdate(update: ExplorerTroopsSystemUpdate)");
    expect(methodStart).toBeGreaterThan(-1);

    const methodBody = source.slice(methodStart, methodStart + 2600);
    expect(methodBody).toContain("shouldAcceptTrackedArmyStaminaSnapshot");
    expect(methodBody).toContain("if (!shouldAcceptSnapshot) {");
  });
});

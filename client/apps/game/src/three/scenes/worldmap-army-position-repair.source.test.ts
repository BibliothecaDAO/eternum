import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(filename: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, filename), "utf8");
}

describe("Worldmap army position repair wiring", () => {
  it("delegates repair planning to the shared single-pass planner", () => {
    const source = readSource("worldmap.tsx");

    const methodStart = source.indexOf("private reconcileAllArmyPositionsFromManager(");
    expect(methodStart).toBeGreaterThan(0);
    const methodEnd = source.indexOf("\n  private ", methodStart + 20);
    const body = source.slice(methodStart, methodEnd);

    expect(body).toContain("this.planArmyPositionRepairs(this.resolveArmyPositionRepairTargets())");
    expect(body).toContain("this.applyArmyPositionRepair(repair, reason)");
  });

  it("defines a repair seam that reconciles worldmap caches from ArmyManager", () => {
    const source = readSource("worldmap.tsx");

    const targetStart = source.indexOf("private resolveArmyPositionRepairTarget(");
    expect(targetStart).toBeGreaterThan(0);
    const targetEnd = source.indexOf("\n  private ", targetStart + 20);
    const targetBody = source.slice(targetStart, targetEnd);

    expect(targetBody).toContain("this.armyManager.isArmyMovingOptimistically(entityId)");
    expect(targetBody).toContain("this.armyManager.getArmy(entityId)");

    const repairStart = source.indexOf("private applyArmyPositionRepair(");
    expect(repairStart).toBeGreaterThan(0);
    const repairEnd = source.indexOf("\n  private ", repairStart + 20);
    const repairBody = source.slice(repairStart, repairEnd);

    expect(repairBody).toContain("this.removeArmyHexEntries(entityId, staleEntries)");
    expect(repairBody).toContain("this.updateArmyHexes(");
    expect(repairBody).toContain("this.armyManager.syncArmyVisualToTrackedPosition(entityId)");
  });

  it("repairs after authoritative tile updates and stale ExplorerTroops skips", () => {
    const source = readSource("worldmap.tsx");

    const tileStart = source.indexOf("this.worldUpdateListener.Army.onTileUpdate(async");
    expect(tileStart).toBeGreaterThan(0);
    const tileEnd = source.indexOf("this.addWorldUpdateSubscription(", tileStart + 100);
    const tileBody = source.slice(tileStart, tileEnd);
    expect(tileBody).toMatch(
      /await this\.armyManager\.onTileUpdate\(update\)[\s\S]{0,400}this\.reconcileArmyPositionFromManager\(update\.entityId, "tile_update"\)/,
    );

    const troopsStart = source.indexOf("this.worldUpdateListener.Army.onExplorerTroopsUpdate");
    expect(troopsStart).toBeGreaterThan(0);
    const troopsEnd = source.indexOf("this.addWorldUpdateSubscription(", troopsStart + 100);
    const troopsBody = source.slice(troopsStart, troopsEnd);
    expect(troopsBody).toContain("reconcileArmyPositionFromManager:");
    expect(troopsBody).toContain('this.reconcileArmyPositionFromManager(entityId, "explorer_troops_update")');
  });

  it("repairs after chunk hydration so existing drift self-heals while browsing", () => {
    const source = readSource("worldmap.tsx");

    const hydrateStart = source.indexOf("private hydrateChunkForPresentation(");
    expect(hydrateStart).toBeGreaterThan(0);
    const hydrateBody = source.slice(hydrateStart, hydrateStart + 900);

    expect(hydrateBody).toContain('this.reconcileAllArmyPositionsFromManager("chunk_hydrated")');
  });

  it("repairs before army selection reads cached action-path positions", () => {
    const source = readSource("worldmap.tsx");

    const selectionStart = source.indexOf("private onArmySelection(");
    expect(selectionStart).toBeGreaterThan(0);
    const selectionBody = source.slice(selectionStart, selectionStart + 2600);

    const repairIndex = selectionBody.indexOf(
      'this.reconcileArmyPositionFromManager(selectedEntityId, "army_selection")',
    );
    const managerCheckIndex = selectionBody.indexOf("this.armyManager.hasArmy(selectedEntityId)");

    expect(repairIndex).toBeGreaterThan(0);
    expect(managerCheckIndex).toBeGreaterThan(0);
    expect(repairIndex).toBeLessThan(managerCheckIndex);
  });
});

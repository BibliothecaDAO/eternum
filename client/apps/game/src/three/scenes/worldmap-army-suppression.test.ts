import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, relativePath), "utf8");
}

describe("worldmap army suppression integration", () => {
  it("cancelPendingArmyRemoval calls unsuppressArmy", () => {
    const src = readSource("worldmap.tsx");

    const methodStart = src.indexOf("private cancelPendingArmyRemoval(");
    expect(methodStart).toBeGreaterThan(-1);

    const methodBody = src.slice(methodStart, methodStart + 900);
    expect(methodBody).toContain("unsuppressArmy(entityId)");
  });

  it("cancelPendingArmyRemoval handles deferred removals that no longer have a timeout handle", () => {
    const src = readSource("worldmap.tsx");

    const methodStart = src.indexOf("private cancelPendingArmyRemoval(");
    expect(methodStart).toBeGreaterThan(-1);

    const methodBody = src.slice(methodStart, methodStart + 800);
    expect(methodBody).toContain("this.deferredChunkRemovals.has(entityId)");
  });

  it("cancelPendingArmyRemoval does not restore visuals before state catches up", () => {
    const src = readSource("worldmap.tsx");

    const methodStart = src.indexOf("private cancelPendingArmyRemoval(");
    expect(methodStart).toBeGreaterThan(-1);

    const methodBody = src.slice(methodStart, methodStart + 900);
    expect(methodBody).not.toContain("restoreArmyVisualIfVisible(entityId)");
  });

  it("tile updates restore visuals after ArmyManager applies the move", () => {
    const src = readSource("worldmap.tsx");

    const listenerStart = src.indexOf(
      "this.worldUpdateListener.Army.onTileUpdate(async (update: ExplorerTroopsTileSystemUpdate) => {",
    );
    expect(listenerStart).toBeGreaterThan(-1);

    const listenerBody = src.slice(listenerStart, listenerStart + 3200);
    const movePos = listenerBody.indexOf("await this.armyManager.onTileUpdate(update)");
    const restorePos = listenerBody.indexOf("restoreArmyVisualIfVisible(update.entityId)");

    expect(movePos).toBeGreaterThan(-1);
    expect(restorePos).toBeGreaterThan(-1);
    expect(restorePos).toBeGreaterThan(movePos);
  });

  it("troop updates do not recover visuals before tile state catches up", () => {
    const src = readSource("worldmap.tsx");

    const listenerStart = src.indexOf("this.worldUpdateListener.Army.onExplorerTroopsUpdate((update) => {");
    expect(listenerStart).toBeGreaterThan(-1);

    const listenerBody = src.slice(listenerStart, listenerStart + 1200);
    expect(listenerBody).not.toContain("this.cancelPendingArmyRemoval(update.entityId)");
    expect(listenerBody).not.toContain("restoreArmyVisualIfVisible(update.entityId)");
    expect(listenerBody).toContain("this.armyManager.updateArmyFromExplorerTroopsUpdate(update)");
  });
});

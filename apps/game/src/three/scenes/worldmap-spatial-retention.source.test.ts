// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Worldmap spatial cache retention", () => {
  it("retains render-area state instead of mirroring the whole projection into the worker", () => {
    const source = readFileSync(resolve(process.cwd(), "src/three/scenes/worldmap.tsx"), "utf8");
    const lifecycleStart = source.indexOf("private bindWorldSpatialProjectionLifecycle()");
    const lifecycleEnd = source.indexOf("private syncProjectedArmyPathfinding(", lifecycleStart);
    const lifecycleBody = source.slice(lifecycleStart, lifecycleEnd);
    const rebuildStart = source.indexOf("private rebuildPathfindingWorkerState()");
    const rebuildEnd = source.indexOf("private buildRetainedPathfindingWorldState(", rebuildStart);
    const rebuildBody = source.slice(rebuildStart, rebuildEnd);
    const tileCollectionStart = source.indexOf("private collectRetainedTilePathfinding(");
    const tileCollectionEnd = source.indexOf("private collectRetainedStructurePathfinding(", tileCollectionStart);
    const tileCollectionBody = source.slice(tileCollectionStart, tileCollectionEnd);

    expect(lifecycleBody).not.toContain("getStructures().forEach");
    expect(lifecycleBody).not.toContain("getArmies().forEach");
    expect(source).toMatch(/private updatePinnedChunks\([\s\S]*this\.pruneWorldmapSpatialCaches\(\)/);
    expect(source).toMatch(/clearCache\(\)[\s\S]*this\.exploredTiles\.clear\(\)/);
    expect(rebuildBody).toContain("gameWorkerManager.hydrateWorldState(");
    expect(rebuildBody).not.toContain("gameWorkerManager.resetWorldState(");
    expect(rebuildBody).not.toContain("gameWorkerManager.updateExploredTile(");
    expect(rebuildBody).not.toContain("gameWorkerManager.updateStructureHex(");
    expect(rebuildBody).not.toContain("gameWorkerManager.updateArmyHex(");
    expect(tileCollectionBody).toContain("worldSpatialProjection.getTilesInBounds(");
    expect(tileCollectionBody).not.toContain("this.exploredTiles");
    expect(source).toContain("private buildProjectedExploredTileIndex(");
    expect(source).not.toMatch(/findActionPaths\([\s\S]{0,250}this\.exploredTiles/);
  });
});

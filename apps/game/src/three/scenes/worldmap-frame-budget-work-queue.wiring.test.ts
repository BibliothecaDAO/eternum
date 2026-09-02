import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const worldmapSource = readFileSync(new URL("./worldmap.tsx", import.meta.url), "utf8");
const armyManagerSource = readFileSync(new URL("../managers/army-manager.ts", import.meta.url), "utf8");
const structureManagerSource = readFileSync(new URL("../managers/structure-manager.ts", import.meta.url), "utf8");
const chestManagerSource = readFileSync(new URL("../managers/chest-manager.ts", import.meta.url), "utf8");

describe("worldmap frame-budget work queue wiring", () => {
  it("owns one queue with loading and play budgets", () => {
    expect(worldmapSource.match(/new FrameBudgetWorkQueue/g)).toHaveLength(1);
    expect(worldmapSource).toContain("isLoading: () => !this.hasInitialized");
    expect(worldmapSource).not.toContain("visualTerrainBuildQueue");
    expect(worldmapSource).not.toContain("visualTerrainBuildFrameHandle");
  });

  it("routes terrain, manager catch-up, and prefetch preparation through that queue", () => {
    expect(worldmapSource).toContain("this.schedulePreparedTerrainCommit(request.priority, preparedTerrain");
    expect(worldmapSource).toContain("`terrain:${workLane}-page-build`");
    expect(worldmapSource).toContain("`terrain:${workLane}-commit`");
    expect(worldmapSource).toContain("`terrain:${workLane}-prepare`");
    expect(worldmapSource).not.toContain('"terrain:hex-grid"');
    expect(worldmapSource).toMatch(/this\.proceduralTerrain\s*\.presentAsync\(/);
    expect(worldmapSource).toContain(
      'this.prepareTerrainChunk(targetStartRow, targetStartCol, height, width, "prefetch")',
    );
    expect(worldmapSource).not.toContain("requestAnimationFrame(processFrame)");
    // Army manager, structure manager, chest manager and the terrain present pipeline share the one queue.
    expect(worldmapSource.match(/this\.chunkWorkQueue,/g)).toHaveLength(4);
    expect(worldmapSource).toMatch(/subdivisions: 2,\s*\},\s*this\.chunkWorkQueue,?\s*\)/);
    expect(armyManagerSource).toContain('"manager:army-projection"');
    expect(armyManagerSource).toContain('"manager:army-visibility"');
    expect(armyManagerSource).toContain('"manager:army-entering"');
    expect(armyManagerSource.indexOf("await this.preloadMissingProjectedArmyModels(renderables)")).toBeLessThan(
      armyManagerSource.indexOf('"manager:army-entering"'),
    );
    expect(
      armyManagerSource.indexOf(".then(() => this.preloadMissingProjectedArmyModelsForEntity(entityId))"),
    ).toBeLessThan(armyManagerSource.indexOf('"manager:army-projection"'));
    expect(structureManagerSource).toMatch(
      /await this\.requestVisibleStructuresRefresh\(\{\s*refreshExisting:.*\s*transitionToken:.*\s*workLane: "critical",\s*\}\);/,
    );
    expect(structureManagerSource).toContain('"manager:structure-visibility-diff"');
    expect(chestManagerSource).toContain('"manager:chest-visibility"');
  });
});

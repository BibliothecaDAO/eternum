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
    expect(worldmapSource).toContain("this.chunkWorkQueue.schedule(workLane, processWorkUnit)");
    expect(worldmapSource).toContain(
      'this.prepareTerrainChunk(targetStartRow, targetStartCol, height, width, "prefetch")',
    );
    expect(worldmapSource).not.toContain("requestAnimationFrame(processFrame)");
    expect(worldmapSource.match(/this\.chunkWorkQueue,/g)).toHaveLength(3);
    expect(armyManagerSource).toContain(
      'scheduleFrameBudgetWork(this.chunkWorkScheduler, "critical", () => this.ensureArmyPresentation(renderable))',
    );
    expect(armyManagerSource.indexOf("await this.preloadMissingProjectedArmyModels(renderables)")).toBeLessThan(
      armyManagerSource.indexOf(
        'scheduleFrameBudgetWork(this.chunkWorkScheduler, "critical", () => this.ensureArmyPresentation(renderable))',
      ),
    );
    expect(
      armyManagerSource.indexOf(".then(() => this.preloadMissingProjectedArmyModelsForEntity(entityId))"),
    ).toBeLessThan(armyManagerSource.indexOf('scheduleFrameBudgetWork(this.chunkWorkScheduler, "visible"'));
    expect(structureManagerSource).toContain('this.requestVisibleStructuresRefresh("critical")');
    expect(structureManagerSource).toContain("await scheduleFrameBudgetWork(this.chunkWorkScheduler, workLane");
    expect(chestManagerSource).toContain(
      "scheduleFrameBudgetWork(this.chunkWorkScheduler, workLane, () => this.renderVisibleChests(chunkKey))",
    );
  });
});

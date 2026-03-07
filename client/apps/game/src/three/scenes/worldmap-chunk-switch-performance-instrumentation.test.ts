import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readWorldmapSource(): string {
  const scenesDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(scenesDir, "worldmap.tsx"), "utf8");
}

describe("worldmap chunk-switch performance instrumentation", () => {
  it("tracks explicit chunk-switch phases in the worldmap source", () => {
    const source = readWorldmapSource();

    expect(source).toContain('PerformanceMonitor.begin("chunkSwitch.total")');
    expect(source).toContain('PerformanceMonitor.begin("chunkSwitch.terrainBuild")');
    expect(source).toContain('PerformanceMonitor.begin("chunkSwitch.tileFetchAwait")');
    expect(source).toContain('PerformanceMonitor.begin("chunkSwitch.boundsAwait")');
    expect(source).toContain('PerformanceMonitor.begin("chunkSwitch.managerUpdate")');
    expect(source).toContain('PerformanceMonitor.begin("chunkRefresh.total")');
    expect(source).toContain('PerformanceMonitor.begin("chunkRefresh.terrainBuild")');
    expect(source).toContain('PerformanceMonitor.begin("chunkRefresh.tileFetchAwait")');
    expect(source).toContain('PerformanceMonitor.begin("chunkRefresh.boundsAwait")');
    expect(source).toContain('PerformanceMonitor.begin("chunkRefresh.managerUpdate")');
    expect(source).toContain('PerformanceMonitor.begin("chunkManager.army")');
    expect(source).toContain('PerformanceMonitor.begin("chunkManager.structure")');
    expect(source).toContain('PerformanceMonitor.begin("chunkManager.chest")');
    expect(source).toContain('PerformanceMonitor.begin("hexGrid.commit")');
    expect(source).toContain('PerformanceMonitor.begin("hexGrid.cacheSnapshot")');
    expect(source).toContain('PerformanceMonitor.begin("hexGrid.interactiveHexes")');
    expect(source).toContain('PerformanceMonitor.begin("hexGrid.processCells")');
  });

  it("uses a single far-view move for spectator route entry", () => {
    const source = readWorldmapSource();

    expect(source).toContain("this.moveCameraToColRowWithView(col, row, CameraView.Far, 0)");
  });

  it("renders spectator terrain through visible biome resolution instead of outline-only fallback", () => {
    const source = readWorldmapSource();

    expect(source).toContain("resolveVisibleWorldmapBiome({");
  });

  it("commits the target chunk before awaiting tile hydration", () => {
    const source = readWorldmapSource();
    const commitIndex = source.indexOf("this.currentChunk = chunkKey;");
    const awaitIndex = source.indexOf("tileFetchSucceeded = await tileFetchPromise;");

    expect(commitIndex).toBeGreaterThan(-1);
    expect(awaitIndex).toBeGreaterThan(-1);
    expect(commitIndex).toBeLessThan(awaitIndex);
  });

  it("does not reference removed rollback-only chunk coordinate locals", () => {
    const source = readWorldmapSource();

    expect(source).not.toContain("hasFiniteOldChunkCoordinates");
    expect(source).not.toContain("oldChunkCoordinates");
  });
});

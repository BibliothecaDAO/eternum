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
    expect(source).toContain('PerformanceMonitor.begin("chunkSwitch.managerUpdate")');
    expect(source).toContain('PerformanceMonitor.begin("chunkRefresh.total")');
    expect(source).toContain('PerformanceMonitor.begin("chunkRefresh.terrainBuild")');
    expect(source).toContain('PerformanceMonitor.begin("chunkRefresh.tileFetchAwait")');
    expect(source).toContain('PerformanceMonitor.begin("chunkRefresh.managerUpdate")');
    expect(source).toContain('PerformanceMonitor.begin("hexGrid.commit")');
    expect(source).toContain('PerformanceMonitor.begin("hexGrid.cacheSnapshot")');
    expect(source).toContain('PerformanceMonitor.begin("hexGrid.interactiveHexes")');
    expect(source).toContain('PerformanceMonitor.begin("hexGrid.processCells")');
  });
});

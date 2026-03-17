import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readWorldmapSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const worldmapPath = resolve(currentDir, "worldmap.tsx");
  return readFileSync(worldmapPath, "utf8");
}

describe("worldmap hydrated refresh regression", () => {
  it("suppresses forced hydrated refreshes while the current chunk refresh is already incorporating the fetch", () => {
    const source = readWorldmapSource();

    expect(source).toMatch(/hydratedRefreshSuppression/i);
    expect(source).toMatch(/shouldScheduleHydratedChunkRefreshForFetch\s*\(\s*\{/);
    expect(source).toMatch(/suppressedAreaKeys/);
  });

  it("routes hydrated refreshes through the chunk presentation readiness gate", () => {
    const source = readWorldmapSource();

    expect(source).toMatch(/waitForStructureHydrationIdle/);
    expect(source).toMatch(/prewarmChunkAssets/);
    expect(source).toMatch(/prepareTerrainChunk/);
    expect(source).toMatch(/applyPreparedTerrainChunk/);
  });
});

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readWorldmapSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "worldmap.tsx"), "utf8");
}

describe("worldmap performance regressions", () => {
  it("derives chunk-cache invalidation from overlap math instead of scanning every cached chunk key", () => {
    const source = readWorldmapSource();

    expect(source).toMatch(/getPotentialChunkKeysContainingHexInRenderBounds/);
    expect(source).not.toMatch(/invalidateAllChunkCachesContainingHex[\s\S]*chunkKeys:\s*this\.cachedMatrices\.keys\(\)/);
  });

  it("caches terrain-count snapshots for spectator hydration and cache validation", () => {
    const source = readWorldmapSource();

    expect(source).toMatch(/private\s+terrainCountSnapshots:\s*Map<string,\s*TerrainCountSnapshot>\s*=\s*new Map\(\)/);
    expect(source).toMatch(/private\s+getTerrainCountSnapshot\s*\(/);
    expect(source).toMatch(/getExpectedVisibleTerrainInstances[\s\S]*this\.getTerrainCountSnapshot\(/);
    expect(source).toMatch(/getResolvedSpectatorTileInstances[\s\S]*this\.getTerrainCountSnapshot\(/);
  });
});

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

  it("stores terrain cache entries from cache-owned dense buffers instead of snapshotting live instanced meshes after commit", () => {
    const source = readWorldmapSource();

    expect(source).toMatch(/interface\s+CachedMatrixEntry\s*\{[\s\S]*matrices:\s*Float32Array\s*\|\s*null;/);
    expect(source).toMatch(/private\s+cacheGeneratedTerrainBuffersForChunk\s*\(/);
    expect(source).not.toMatch(/updateHexagonGrid[\s\S]*this\.cacheMatricesForChunk\(startRow,\s*startCol\)/);
  });

  it("updates interactive hex windows incrementally for adjacent chunk shifts", () => {
    const source = readWorldmapSource();

    expect(source).toMatch(/private\s+currentInteractiveWindow:/);
    expect(source).toMatch(/computeInteractiveHexes[\s\S]*resolveHexGridStripUpdatePlan\(/);
    expect(source).toMatch(
      /computeInteractiveHexes[\s\S]*if\s*\(!stripPlan\s*\|\|\s*stripPlan\.mode === "full"\)\s*\{[\s\S]*this\.interactiveHexManager\.clearHexes\(\)/,
    );
  });
});

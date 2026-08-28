import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readWorldmapSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const worldmapPath = resolve(currentDir, "worldmap.tsx");
  return readFileSync(worldmapPath, "utf8");
}

describe("worldmap hex-grid pass count", () => {
  it("reuses generated explored coverage metadata instead of rescanning the full render window during cache validation", () => {
    const source = readWorldmapSource();

    expect(source).toContain("this.cachePreparedTerrainChunk(preparedTerrain as PreparedTerrainChunk)");
    expect(source).toMatch(/cachedChunk\.set\("__meta__",/);
    expect(source).toMatch(/cachedMetadata\?\.expectedExploredTerrainInstances/);
    expect(source).not.toContain("cacheMatricesForChunk(");
  });
});

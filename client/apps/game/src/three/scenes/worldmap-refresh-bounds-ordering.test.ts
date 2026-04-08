import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readWorldmapSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "worldmap.tsx"), "utf8");
}

function extractRefreshCurrentChunkMethod(source: string): string {
  const start = source.indexOf("  private async refreshCurrentChunk(");
  const end = source.indexOf("  private async updateManagersForChunk(", start);
  return source.slice(start, end);
}

describe("worldmap refresh bounds ordering", () => {
  it("updates current chunk bounds only after prepared terrain commit in refreshCurrentChunk", () => {
    const methodSource = extractRefreshCurrentChunkMethod(readWorldmapSource());

    const hydrateIndex = methodSource.indexOf("await runWorldmapRefreshRuntime({");
    const commitRuntimeIndex = methodSource.indexOf("commitWorldmapPreparedTerrainPresentation({");
    const updateBoundsIndex = methodSource.indexOf("this.updateCurrentChunkBounds(startRow, startCol);");

    expect(hydrateIndex).toBeGreaterThanOrEqual(0);
    expect(commitRuntimeIndex).toBeGreaterThanOrEqual(0);
    expect(updateBoundsIndex).toBeGreaterThan(commitRuntimeIndex);
    expect(updateBoundsIndex).toBeGreaterThan(hydrateIndex);
  });

  it("keeps bounds updates inside the successful prepared terrain commit branch", () => {
    const methodSource = extractRefreshCurrentChunkMethod(readWorldmapSource());

    expect(methodSource).toMatch(
      /handleWorldmapRefreshCommitRuntime\(\{[\s\S]*?commitPreparedTerrain: \(nextPreparedTerrain\) => \{[\s\S]*?commitWorldmapPreparedTerrainPresentation\(\{[\s\S]*?this\.applyPreparedTerrainChunk\(preparedTerrain\);[\s\S]*?this\.updateCurrentChunkBounds\(startRow, startCol\);/s,
    );
  });
});

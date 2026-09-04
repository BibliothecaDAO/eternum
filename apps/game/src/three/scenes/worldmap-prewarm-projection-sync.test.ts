import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

function readWorldmapSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "worldmap.tsx"), "utf8");
}

describe("prewarmDirectionalPresentationChunk projection sync", () => {
  it("syncs projection tiles before preparing terrain", () => {
    const source = readWorldmapSource();

    // Extract the prewarmDirectionalPresentationChunk method body
    const methodStart = source.indexOf("private async prewarmDirectionalPresentationChunk");
    expect(methodStart).toBeGreaterThan(-1);

    // Get a reasonable window of the method body (enough to cover the prepareWorldmapChunkPresentation call)
    const methodBody = source.slice(methodStart, methodStart + 1500);

    // The method must NOT use Promise.resolve(true) as the projectionSyncPromise
    expect(methodBody).not.toMatch(/projectionSyncPromise:\s*Promise\.resolve\(true\)/);

    expect(methodBody).toMatch(/projectionSyncPromise:.*syncProjectionTilesForChunk/s);
  });

  it("prewarm still respects isLatestToken and isSwitchedOff guards", () => {
    const source = readWorldmapSource();

    const methodStart = source.indexOf("private async prewarmDirectionalPresentationChunk");
    expect(methodStart).toBeGreaterThan(-1);

    const methodBody = source.slice(methodStart, methodStart + 1500);

    // isLatestToken guard must reference isSwitchedOff
    expect(methodBody).toMatch(/isSwitchedOff/);

    // isLatestToken guard must reference chunkTransitionToken
    expect(methodBody).toMatch(/chunkTransitionToken/);
  });

  it("prepareWorldmapChunkPresentation skips terrain when projectionSyncPromise resolves false", async () => {
    // This test validates that the downstream presentation function correctly
    // gates terrain preparation on projection sync, so a failed local sync
    // prevents stale terrain from being cached.
    const { prepareWorldmapChunkPresentation } = await import("./worldmap-chunk-presentation");

    const prepareTerrainChunk = vi.fn().mockResolvedValue({ chunkKey: "24,24" });

    const result = await prepareWorldmapChunkPresentation({
      chunkKey: "24,24",
      startRow: 24,
      startCol: 24,
      renderSize: { height: 80, width: 90 },
      projectionSyncPromise: Promise.resolve(false),
      assetPrewarmPromise: Promise.resolve(),
      prepareTerrainChunk,
    });

    expect(result.projectionSyncSucceeded).toBe(false);
    expect(result.preparedTerrain).toBeNull();
    expect(prepareTerrainChunk).not.toHaveBeenCalled();
  });

  it("prewarmWorldmapChunkPresentation returns sync_failed when projection sync fails", async () => {
    const { prewarmWorldmapChunkPresentation } = await import("./worldmap-chunk-presentation");

    const cachePreparedTerrain = vi.fn();

    const result = await prewarmWorldmapChunkPresentation({
      chunkKey: "24,24",
      prewarmToken: 7,
      isLatestToken: () => true,
      isPresentationHot: () => false,
      preparePresentation: async () => ({
        projectionSyncSucceeded: false,
        preparedTerrain: null,
      }),
      cachePreparedTerrain,
    });

    expect(result.status).toBe("sync_failed");
    expect(result.preparedTerrain).toBeNull();
    expect(cachePreparedTerrain).not.toHaveBeenCalled();
  });

  it("cached terrain from prewarm reflects real tile data when fetch succeeds", async () => {
    const { prewarmWorldmapChunkPresentation } = await import("./worldmap-chunk-presentation");

    const terrainData = { chunkKey: "24,24", vertices: [1, 2, 3] };
    const cachePreparedTerrain = vi.fn();

    const result = await prewarmWorldmapChunkPresentation({
      chunkKey: "24,24",
      prewarmToken: 7,
      isLatestToken: () => true,
      isPresentationHot: () => false,
      preparePresentation: async () => ({
        projectionSyncSucceeded: true,
        preparedTerrain: terrainData,
      }),
      cachePreparedTerrain,
    });

    expect(result.status).toBe("prepared");
    expect(result.preparedTerrain).toBe(terrainData);
    expect(cachePreparedTerrain).toHaveBeenCalledWith(terrainData);
  });
});

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readWorldmapSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "worldmap.tsx"), "utf8");
}

describe("prewarmDirectionalPresentationChunk tile fetch correctness", () => {
  it("uses a real tile fetch via computeTileEntities instead of Promise.resolve(true)", () => {
    const source = readWorldmapSource();

    // Extract the prewarmDirectionalPresentationChunk method body
    const methodStart = source.indexOf("private async prewarmDirectionalPresentationChunk");
    expect(methodStart).toBeGreaterThan(-1);

    // Get a reasonable window of the method body (enough to cover the prepareWorldmapChunkPresentation call)
    const methodBody = source.slice(methodStart, methodStart + 1500);

    // The method must NOT use Promise.resolve(true) as the tileFetchPromise
    expect(methodBody).not.toMatch(/tileFetchPromise:\s*Promise\.resolve\(true\)/);

    // The method MUST use computeTileEntities for the tileFetchPromise
    expect(methodBody).toMatch(/tileFetchPromise:.*computeTileEntities/s);
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

  it("prepareWorldmapChunkPresentation skips terrain when tileFetchPromise resolves false", async () => {
    // This test validates that the downstream presentation function correctly
    // gates terrain preparation on tile fetch result, so a failed computeTileEntities
    // (returning false) prevents stale terrain from being cached.
    const { prepareWorldmapChunkPresentation } = await import("./worldmap-chunk-presentation");

    const prepareTerrainChunk = vi.fn().mockResolvedValue({ chunkKey: "24,24" });

    const result = await prepareWorldmapChunkPresentation({
      chunkKey: "24,24",
      startRow: 24,
      startCol: 24,
      renderSize: { height: 80, width: 90 },
      tileFetchPromise: Promise.resolve(false),
      tileHydrationReadyPromise: Promise.resolve(),
      boundsReadyPromise: Promise.resolve(),
      structureReadyPromise: Promise.resolve(),
      assetPrewarmPromise: Promise.resolve(),
      prepareTerrainChunk,
    });

    expect(result.tileFetchSucceeded).toBe(false);
    expect(result.preparedTerrain).toBeNull();
    expect(prepareTerrainChunk).not.toHaveBeenCalled();
  });

  it("prewarmWorldmapChunkPresentation returns fetch_failed when tile fetch fails", async () => {
    const { prewarmWorldmapChunkPresentation } = await import("./worldmap-chunk-presentation");

    const cachePreparedTerrain = vi.fn();

    const result = await prewarmWorldmapChunkPresentation({
      chunkKey: "24,24",
      prewarmToken: 7,
      isLatestToken: () => true,
      isPresentationHot: () => false,
      preparePresentation: async () => ({
        tileFetchSucceeded: false,
        preparedTerrain: null,
      }),
      cachePreparedTerrain,
    });

    expect(result.status).toBe("fetch_failed");
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
        tileFetchSucceeded: true,
        preparedTerrain: terrainData,
      }),
      cachePreparedTerrain,
    });

    expect(result.status).toBe("prepared");
    expect(result.preparedTerrain).toBe(terrainData);
    expect(cachePreparedTerrain).toHaveBeenCalledWith(terrainData);
  });
});

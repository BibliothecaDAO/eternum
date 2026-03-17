import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import { prewarmWorldmapChunkPresentation } from "./worldmap-chunk-presentation";

function readWorldmapSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "worldmap.tsx"), "utf8");
}

describe("prewarmWorldmapChunkPresentation", () => {
  it("skips chunks whose presentation is already hot", async () => {
    const preparePresentation = vi.fn();
    const cachePreparedTerrain = vi.fn();

    const result = await prewarmWorldmapChunkPresentation({
      chunkKey: "24,24",
      prewarmToken: 7,
      isLatestToken: () => true,
      isPresentationHot: () => true,
      preparePresentation,
      cachePreparedTerrain,
    });

    expect(result).toEqual({
      status: "skipped_hot",
      preparedTerrain: null,
    });
    expect(preparePresentation).not.toHaveBeenCalled();
    expect(cachePreparedTerrain).not.toHaveBeenCalled();
  });

  it("caches prepared terrain without mutating the visible chunk", async () => {
    const preparedTerrain = { chunkKey: "24,24" };
    const cachePreparedTerrain = vi.fn();

    const result = await prewarmWorldmapChunkPresentation({
      chunkKey: "24,24",
      prewarmToken: 7,
      isLatestToken: () => true,
      isPresentationHot: () => false,
      preparePresentation: async () => ({
        tileFetchSucceeded: true,
        preparedTerrain,
      }),
      cachePreparedTerrain,
    });

    expect(result).toEqual({
      status: "prepared",
      preparedTerrain,
    });
    expect(cachePreparedTerrain).toHaveBeenCalledWith(preparedTerrain);
  });

  it("drops stale prepared presentation instead of caching it", async () => {
    const cachePreparedTerrain = vi.fn();

    const result = await prewarmWorldmapChunkPresentation({
      chunkKey: "24,24",
      prewarmToken: 7,
      isLatestToken: () => false,
      isPresentationHot: () => false,
      preparePresentation: async () => ({
        tileFetchSucceeded: true,
        preparedTerrain: { chunkKey: "24,24" },
      }),
      cachePreparedTerrain,
    });

    expect(result).toEqual({
      status: "stale_dropped",
      preparedTerrain: null,
    });
    expect(cachePreparedTerrain).not.toHaveBeenCalled();
  });
});

describe("worldmap presentation prewarm wiring", () => {
  it("routes the directional forward chunk through presentation prewarm after tile prefetch settles", () => {
    const source = readWorldmapSource();

    expect(source).toMatch(/presentationChunkKeysToPrewarm/);
    expect(source).toMatch(/directionalPresentationChunkKeys/);
    expect(source).toMatch(/prewarmDirectionalPresentationChunk\(/);
  });
});

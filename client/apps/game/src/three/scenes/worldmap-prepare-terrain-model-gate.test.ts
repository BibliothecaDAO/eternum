import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readWorldmapSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "worldmap.tsx"), "utf8");
}

function extractMethod(source: string, signature: string, nextSignature: string): string {
  const start = source.indexOf(signature);
  const end = source.indexOf(nextSignature, start);
  return source.slice(start, end);
}

describe("prepareTerrainChunk — GLTF model-load gate", () => {
  // Regression: on cold starts the prewarm path can populate the cache with a
  // partial biome set (some GLTFs still loading). If the cache-hit branch in
  // prepareTerrainChunk returns before awaiting `modelLoadPromises`, the caller
  // applies a `PreparedTerrainChunk` to a `biomeModels` map that does not yet
  // contain every biome. Missing biomes silently no-op inside
  // applyPreparedTerrainChunk, producing the "armies but no biomes" rendering
  // bug observed on first load.
  it("awaits modelLoadPromises before the cache-hit early return", () => {
    const source = readWorldmapSource();
    const methodSource = extractMethod(
      source,
      "  private async prepareTerrainChunk(",
      "  private cachePreparedTerrainChunk(",
    );

    const gateIndex = methodSource.indexOf("await Promise.all(this.modelLoadPromises)");
    const cacheHitIndex = methodSource.indexOf("this.createPreparedTerrainChunkFromCache(");

    expect(gateIndex).toBeGreaterThanOrEqual(0);
    expect(cacheHitIndex).toBeGreaterThanOrEqual(0);
    expect(gateIndex).toBeLessThan(cacheHitIndex);
  });
});

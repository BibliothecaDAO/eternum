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

describe("applyCachedMatricesForChunk — partial biomeModels guard", () => {
  // Fix 2 calls applyCachedMatricesForChunk from onBiomeModelLoaded, which
  // fires incrementally as GLTFs resolve. When the first biome arrives, the
  // cache may contain entries for biomes still loading — iterating those via
  // this.biomeModels.get(biome)! previously returned undefined and the next
  // setMatricesAndCount call would throw. Skip missing models defensively.
  it("skips biome entries whose InstancedBiome model is not loaded yet", () => {
    const source = readWorldmapSource();
    const methodSource = extractMethod(
      source,
      "  private applyCachedMatricesForChunk(startRow: number, startCol: number)",
      "  private computeChunkBounds(",
    );

    expect(methodSource).toMatch(
      /const hexMesh = this\.biomeModels\.get\(biome as BiomeType\);[\s\S]*?if \(!hexMesh\) \{[\s\S]*?continue;/,
    );
  });
});

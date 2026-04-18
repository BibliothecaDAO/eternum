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

describe("onBiomeModelLoaded — late-arrival flush", () => {
  // Regression: when a biome GLTF resolves AFTER applyPreparedTerrainChunk
  // has already committed for the current chunk, the newly-loaded
  // InstancedBiome has count=0 and stays invisible. Previously
  // onBiomeModelLoaded only called setWorldBounds; it did not re-apply the
  // cached matrices for the current chunk onto the late-arriving model.
  // The resulting bug appeared as "biome hexes missing on initial load, then
  // appear when you zoom/move into a new chunk" because only the next chunk
  // switch re-triggered the apply path.
  it("re-applies cached matrices for the current chunk on late biome model arrival", () => {
    const source = readWorldmapSource();
    const methodSource = extractMethod(
      source,
      "  protected override onBiomeModelLoaded(model: InstancedBiome): void {",
      "  public clearTileEntityCache()",
    );

    expect(methodSource).toMatch(/applyCachedMatricesForChunk\(/);
  });
});

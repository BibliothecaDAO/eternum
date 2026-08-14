import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(filename: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, filename), "utf8");
}

/**
 * Close the "empty hex for a few seconds" gap between tx submission and the
 * authoritative TileOpt delivery. configManager.getBiome mirrors the Cairo
 * biome_library and active world climate config, so we can render the
 * destination biome immediately once the submitted tx hash starts the
 * optimistic tween.
 */
describe("Worldmap optimistic destination biome", () => {
  it("imports configManager from @bibliothecadao/eternum", () => {
    const source = readSource("worldmap.tsx");
    expect(source).toMatch(/import\s*\{[^}]*\bconfigManager\b[^}]*\}\s*from\s*"@bibliothecadao\/eternum"/);
  });

  it("the optimistic destination painter writes provisional biome using configured biome on contract coords", () => {
    const source = readSource("worldmap.tsx");

    const handlerStart = source.indexOf("private paintOptimisticDestinationBiome(");
    const handlerEnd = source.indexOf("\n  private ", handlerStart + 20);
    expect(handlerStart).toBeGreaterThan(0);
    expect(handlerEnd).toBeGreaterThan(handlerStart);
    const body = source.slice(handlerStart, handlerEnd);

    expect(body).toContain("provisionalBiomes.mark");
    // Per-chunk terrain generations (Phase 1.3): the painter bumps the generation
    // of every chunk containing the mutated hex via bumpTerrainGenerationForHex.
    expect(body).toContain("bumpTerrainGenerationForHex");
    // Must feed contract (felt-offset) coords to the configured biome helper
    // so the provisional value matches what the Cairo biome_library will
    // write; otherwise the authoritative update will overwrite with a
    // different biome and the player sees the tile flicker.
    expect(body).toMatch(/configManager\.getBiome\(\s*[A-Za-z]+Contract\.x,\s*[A-Za-z]+Contract\.y\s*\)/);
  });
});

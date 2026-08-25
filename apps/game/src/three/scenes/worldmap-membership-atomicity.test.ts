import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readWorldmapSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "worldmap.tsx"), "utf8");
}

function extractClearCacheMethod(source: string): string {
  const start = source.indexOf("  clearCache() {");
  const end = source.indexOf("  private scheduleHydratedChunkRefresh(", start);
  return source.slice(start, end);
}

describe("worldmap visible terrain membership atomicity", () => {
  it("does not clear visible terrain membership during cache teardown", () => {
    const clearCacheSource = extractClearCacheMethod(readWorldmapSource());

    expect(clearCacheSource).not.toMatch(/this\.visibleTerrainMembership\.clear\(\);/);
  });

  it("still replaces visible terrain membership atomically on prepared terrain commit", () => {
    const source = readWorldmapSource();

    expect(source).toMatch(/this\.setVisibleTerrainMembership\(preparedTerrain\.visibleTerrainOwnership\);/);
    expect(source).toMatch(/this\.visibleTerrainMembership = membershipResult\.membership;/);
  });
});

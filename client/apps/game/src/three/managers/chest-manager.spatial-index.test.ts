import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readChestManagerSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const filePath = resolve(currentDir, "chest-manager.ts");
  return readFileSync(filePath, "utf8");
}

describe("ChestManager spatial index", () => {
  it("queries the shared projection instead of owning chest truth", () => {
    const source = readChestManagerSource();

    expect(source).toMatch(/worldSpatialProjection\s*\.getChestsInBounds/);
    expect(source).not.toContain("class Chests");
    expect(source).not.toContain("chestHexCoords");
    expect(source).not.toContain("chunkToChests");
  });
});

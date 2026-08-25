import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readStructureManagerSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "structure-manager.ts"), "utf8");
}

describe("StructureManager projection wiring", () => {
  it("uses the shared projection for spatial truth without a structure truth store", () => {
    const source = readStructureManagerSource();

    expect(source).toMatch(/private readonly worldSpatialProjection: WorldSpatialProjection/);
    expect(source).toMatch(/worldSpatialProjection\.subscribeStructures/);
    expect(source).not.toMatch(/StructureRecordStore|structureHexCoords|chunkToStructures/);
  });
});

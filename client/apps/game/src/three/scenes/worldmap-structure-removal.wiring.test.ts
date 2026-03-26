import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readWorldmapSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "worldmap.tsx"), "utf8");
}

describe("worldmap structure removal wiring", () => {
  it("routes removed structure tile updates through a dedicated removal helper", () => {
    const source = readWorldmapSource();

    expect(source).toMatch(/if \(value\.kind === "removed"\) \{\s*this\.handleRemovedStructureTileUpdate\(value\);/s);
  });

  it("removal helper clears local structure state and requests visible reconciliation", () => {
    const source = readWorldmapSource();

    expect(source).toMatch(
      /private handleRemovedStructureTileUpdate\(value: StructureTileRemovedUpdate\)[\s\S]*?this\.structuresPositions\.delete\(value\.entityId\)/s,
    );
    expect(source).toMatch(
      /private handleRemovedStructureTileUpdate\(value: StructureTileRemovedUpdate\)[\s\S]*?gameWorkerManager\.updateStructureHex\([^,]+,[^,]+,\s*null\)/s,
    );
    expect(source).toMatch(
      /private handleRemovedStructureTileUpdate\(value: StructureTileRemovedUpdate\)[\s\S]*?this\.invalidateAllChunkCachesContainingHex\(/s,
    );
    expect(source).toMatch(
      /private handleRemovedStructureTileUpdate\(value: StructureTileRemovedUpdate\)[\s\S]*?this\.structureManager\.removeStructure\(value\.entityId,\s*previousHex\)/s,
    );
    expect(source).toMatch(
      /private handleRemovedStructureTileUpdate\(value: StructureTileRemovedUpdate\)[\s\S]*?this\.scheduleTileRefreshIfAffectsCurrentRenderBounds\(/s,
    );
  });
});

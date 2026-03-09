import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readWorldmapSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "worldmap.tsx"), "utf8");
}

describe("worldmap structure-owner indexing", () => {
  it("indexes tracked army owners by structure id", () => {
    const source = readWorldmapSource();

    expect(source).toMatch(/private\s+armyIdsByStructureOwner:\s*Map<ID,\s*Set<ID>>\s*=\s*new Map\(\)/);
    expect(source).toMatch(/private\s+setArmyStructureOwner\s*\(/);
    expect(source).toMatch(/private\s+clearArmyStructureOwner\s*\(/);
  });

  it("uses indexed owner lookups for attached-army sync", () => {
    const source = readWorldmapSource();

    expect(source).toMatch(
      /private\s+syncAttachedArmiesForStructureOwner[\s\S]*const\s+trackedArmyIds\s*=\s*this\.armyIdsByStructureOwner\.get\(update\.entityId\)/,
    );
    expect(source).not.toMatch(
      /private\s+syncAttachedArmiesForStructureOwner[\s\S]*this\.armyStructureOwners\.forEach/,
    );
  });

  it("uses targeted attached-army lookups for ownership pulses", () => {
    const source = readWorldmapSource();

    expect(source).toMatch(/private\s+updateStructureOwnershipPulses[\s\S]*this\.armyManager\.getArmiesForStructure\(structureId\)/);
    expect(source).not.toMatch(/private\s+updateStructureOwnershipPulses[\s\S]*this\.armyManager\.getArmies\(\)/);
    expect(source).not.toMatch(/private\s+updateStructureOwnershipPulses[\s\S]*this\.armyStructureOwners\.forEach/);
  });
});

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readWorldmapSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "worldmap.tsx"), "utf8");
}

describe("WorldMap troop arrival wiring", () => {
  it("subscribes to public incoming troop arrivals and forwards them to StructureManager", () => {
    const source = readWorldmapSource();

    expect(source).toMatch(/state\) => state\.publicIncomingTroopArrivalsByStructure/);
    expect(source).toMatch(
      /this\.structureManager\.setIncomingTroopArrivalsByStructure\(publicIncomingTroopArrivalsByStructure\)/,
    );
    expect(source).toMatch(
      /this\.structureManager\.setIncomingTroopArrivalsByStructure\(uiState\.publicIncomingTroopArrivalsByStructure\)/,
    );
  });
});

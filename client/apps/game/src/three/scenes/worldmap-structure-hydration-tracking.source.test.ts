import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));

describe("worldmap structure projection wiring", () => {
  it("renders structures from the shared projection without scene-local structure streams or hydration", () => {
    const source = readFileSync(resolve(currentDir, "worldmap.tsx"), "utf8");

    expect(source).toContain("this.worldSpatialProjection.subscribeStructures");
    expect(source).toContain("this.worldSpatialProjection.getStructuresAtHex");
    expect(source).toContain("this.buildProjectedStructureActionIndex()");
    expect(source).not.toContain("worldUpdateListener.Structure.onStructureUpdate");
    expect(source).not.toContain("worldUpdateListener.Structure.onTileUpdate");
    expect(source).not.toContain("trackStructureHydrationUpdate");
    expect(source).not.toContain("structureHexes");
    expect(source).not.toContain("structuresPositions");
  });
});

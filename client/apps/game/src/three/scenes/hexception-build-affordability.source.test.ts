// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Hexception build affordability", () => {
  it("re-checks preview affordability before placing a building from a map click", () => {
    const source = readSource("src/three/scenes/hexception.tsx");

    expect(source).toContain("canAffordPreviewBuilding");
    expect(source).toContain(
      "if (!this.canAffordPreviewBuilding(structureEntityId, buildingType.type, useSimpleCost))",
    );
    expect(source).toContain('toast.error("Insufficient resources to build here.");');
    expect(source).toMatch(
      /if \(!this\.canAffordPreviewBuilding\(structureEntityId, buildingType\.type, useSimpleCost\)\) \{[\s\S]*reserveOccupiedBuildSpot\(structureEntityId, normalizedCoords\);/,
    );
  });
});

// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("SelectPreviewBuildingMenu destroy reservation wiring", () => {
  it("reserves a vacated tile while destroy confirmation is still pending", () => {
    const source = readSource("src/ui/features/settlement/construction/select-preview-building.tsx");

    expect(source).toContain("reserveVacatedBuildSpot");
    expect(source).toContain("releaseVacatedBuildSpot");
    expect(source).toMatch(
      /const existing = tileManager\.existingBuildings\(\)\.find\(\(building\) => building\.category === target\.type\);[\s\S]*reserveVacatedBuildSpot\(entityId, \{ col: existing\.col, row: existing\.row \}\);[\s\S]*await tileManager\.destroyBuilding/,
    );
    expect(source).toMatch(
      /catch \(error\) \{[\s\S]*releaseVacatedBuildSpot\(entityId, \{ col: existing\.col, row: existing\.row \}\);/,
    );
  });
});

// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("construction intent reconcile wiring", () => {
  it("uses indexed building reads instead of optimistic building overrides", () => {
    const tileManagerSource = readSource("../../../packages/core/src/managers/tile-manager.ts");
    const hexceptionSource = readSource("src/three/scenes/hexception.tsx");
    const previewSource = readSource("src/ui/features/settlement/construction/select-preview-building.tsx");

    expect(tileManagerSource).toContain("getIndexedBuilding = (hexCoords: HexPosition)");

    expect(hexceptionSource).toContain("const building = this.tileManager.getIndexedBuilding(spot);");
    expect(hexceptionSource).not.toContain("const building = this.tileManager.getBuilding(spot);");

    expect(previewSource).toContain("const building = tileManager.getIndexedBuilding({ col, row });");
    expect(previewSource).not.toContain("const building = tileManager.getBuilding({ col, row });");
  });
});

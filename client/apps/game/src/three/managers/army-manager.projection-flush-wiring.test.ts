// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("ArmyManager projection flush wiring", () => {
  it("keeps collection and GPU buffer refreshes behind one pre-render flush", () => {
    const source = readFileSync(resolve(process.cwd(), "src/three/managers/army-manager.ts"), "utf8");

    expect(source.match(/this\.refreshVisibleArmyCollection\(\)/g)).toHaveLength(1);
    expect(source.match(/this\.updateVisibleArmyBuffers\(\)/g)).toHaveLength(1);
    expect(source.match(/this\.flushVisibleArmyPresentation\(\)/g)).toHaveLength(1);
    expect(source).toMatch(
      /update\(deltaTime:[\s\S]*?this\.flushVisibleArmyPresentation\(\);[\s\S]*?this\.armyModel\.updateMovements/,
    );
  });

  it("invalidates shadow content after moving army transforms update", () => {
    const source = readFileSync(resolve(process.cwd(), "src/three/managers/army-manager.ts"), "utf8");

    expect(source).toMatch(
      /update\(deltaTime:[\s\S]*?this\.armyModel\.updateMovements\(deltaTime\);\s*this\.requestMovingArmyShadowRefresh\(\);/,
    );
    expect(source).toMatch(
      /private requestMovingArmyShadowRefresh\(\): void \{\s*if \(this\.currentCameraView !== CameraView\.Close \|\| !this\.hasMovingArmies\(\)\) \{\s*return;\s*\}\s*this\.hexagonScene\?\.requestShadowContentRefresh\(\);/,
    );
  });
});

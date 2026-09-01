// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("terrain movement interaction production wiring", () => {
  it("derives consolidated dust and wakes from visible presentation after movement updates", () => {
    const armyManager = source("src/three/managers/army-manager.ts");
    const worldmap = source("src/three/scenes/worldmap.tsx");

    expect(armyManager).toContain("collectVisibleTerrainMovementInteractions");
    expect(armyManager).toContain("resolveArmyTerrainMovementMode");
    expect(armyManager).toContain("interaction.isMoving = this.armyModel.isEntityMoving(entityId)");
    expect(armyManager).toContain('return "airborne"');
    expect(worldmap).toMatch(
      /this\.armyManager\.update\(deltaTime, animationContext\);\s+this\.syncTerrainMovementInteractions\(\);/,
    );
    expect(worldmap).toContain("this.proceduralTerrain.setMovementInteractions(this.terrainMovementInteractionBuffer)");
  });
});

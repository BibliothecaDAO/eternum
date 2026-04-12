// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Worldmap travel effect lifecycle wiring", () => {
  it("cleans up travel effects on movement completion and preserves them when movement starts", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");

    expect(source).toContain('if (effectType === "travel") {');
    expect(source).toContain("this.armyManager.onMovementComplete(selectedEntityId, cleanup)");
    expect(source).toContain('this.clearPendingArmyMovement(entityId, "movement_started");');
  });
});

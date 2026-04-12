// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Worldmap pending movement visual handoff wiring", () => {
  it("keeps updateArmyHexes focused on cache sync instead of clearing pending movement", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");
    const methodStart = source.indexOf("public updateArmyHexes(");

    expect(methodStart).toBeGreaterThan(-1);

    const methodBody = source.slice(methodStart, methodStart + 2600);
    expect(methodBody).not.toContain('this.clearPendingArmyMovement(entityId, "movement_started")');
    expect(methodBody).not.toContain("this.clearPendingArmyMovement(entityId)");
  });

  it("wires local pending clear to ArmyManager movement-start notifications", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");

    expect(source).toContain("this.armyManager.onMovementStart");
    expect(source).toContain('this.clearPendingArmyMovement(entityId, "movement_started")');
  });
});

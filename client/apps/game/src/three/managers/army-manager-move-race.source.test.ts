// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("ArmyManager.moveArmy race guard", () => {
  it("claims the destination in armies Map synchronously before any await", () => {
    const source = readSource("src/three/managers/army-manager.ts");

    const methodStart = source.indexOf("public async moveArmy(entityId: ID, hexCoords: Position)");
    expect(methodStart).toBeGreaterThan(-1);
    // Read a window large enough to cover the moveArmy body (~2500 chars).
    const methodBody = source.slice(methodStart, methodStart + 2500);

    const claimIndex = methodBody.indexOf("this.armies.set(entityId, { ...armyData, hexCoords })");
    const findPathAwaitIndex = methodBody.indexOf("await gameWorkerManager.findPath");

    expect(claimIndex).toBeGreaterThan(-1);
    expect(findPathAwaitIndex).toBeGreaterThan(-1);
    // Regression guard: moving this set below the findPath await reintroduces
    // the optimistic ↔ authoritative moveArmy ping-pong because a racing
    // second call sees the stale source position and runs a second animation
    // that snaps the in-flight instance back to path[0] (source).
    expect(claimIndex).toBeLessThan(findPathAwaitIndex);
  });
});

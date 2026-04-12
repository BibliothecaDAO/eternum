// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Worldmap arrival ghost wiring", () => {
  it("creates a local arrival ghost from the movement submit path", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");

    expect(source).toContain("shouldCreatePredictiveArrivalGhost");
    expect(source).toContain("this.arrivalGhostManager.upsertLocalArrivalGhost");
  });

  it("resolves tracked ghosts from movement completion instead of pending-clear heuristics", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");

    expect(source).toContain("this.armyManager.onMovementComplete");
    expect(source).toContain("this.arrivalGhostManager.resolveArrivalGhost");
    expect(source).not.toContain("shouldResolveArrivalGhost");
  });
});

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
    expect(source).toContain('movementType: actionType === ActionType.Explore ? "explore" : "travel"');
  });

  it("resolves tracked ghosts from movement completion instead of pending-clear heuristics", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");

    expect(source).toContain("this.armyManager.onMovementComplete");
    expect(source).toContain("this.arrivalGhostManager.resolveArrivalGhost");
    expect(source).not.toContain("shouldResolveArrivalGhost");
  });

  it("clears tracked arrival ghosts when movement visuals are cancelled before completion", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");

    expect(source).toContain("this.armyManager.onMovementVisualCancel");
    expect(source).toContain('this.arrivalGhostManager.clearArrivalGhost(entityId, "movement_evicted")');
  });

  it("clears tracked arrival ghosts when explore completes without movement", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");
    const completionStart = source.indexOf("const pendingExploreEntities = resolveExploreCompletionPendingClearPlan");
    expect(completionStart).toBeGreaterThan(-1);

    const completionEnd = source.indexOf("const endCompass = this.travelEffects.get(key)", completionStart);
    const completionBody = source.slice(completionStart, completionEnd);

    expect(completionBody).toContain('this.arrivalGhostManager.clearArrivalGhost(entityId, "arrived")');
    expect(completionBody.indexOf("this.clearPendingArmyMovement(entityId)")).toBeLessThan(
      completionBody.indexOf('this.arrivalGhostManager.clearArrivalGhost(entityId, "arrived")'),
    );
  });

  it("clears tracked arrival ghosts when optimistic movement aborts before animation starts", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");

    const handlerStart = source.indexOf("private async applySubmittedArmyMovementOptimisticPlan(");
    expect(handlerStart).toBeGreaterThan(-1);
    const handlerEnd = source.indexOf("\n  private ", handlerStart + 20);
    const handler = source.slice(handlerStart, handlerEnd);
    const abortCleanupCalls = handler.match(/this\.clearArrivalGhostAfterOptimisticMovementAbort\(entityId, txHash\)/g);

    expect(abortCleanupCalls).toHaveLength(2);
    expect(source).toContain('this.arrivalGhostManager.clearArrivalGhost(entityId, "optimistic_aborted")');
  });
});

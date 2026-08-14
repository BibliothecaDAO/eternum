// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Worldmap pending movement visual handoff wiring", () => {
  it("does not mirror optimistic movement into a scene-local spatial cache", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");

    expect(source).not.toContain("public updateArmyHexes(");
    expect(source).not.toContain("mirrorOptimisticArmyDestinationIntoWorldmapCache");
    expect(source).toContain("private getValidPendingArmyMovementTarget(");
  });

  it("hands movement-start off without clearing authoritative resolution handles", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");

    expect(source).toContain("this.armyManager.onMovementStart");
    expect(source).toContain("this.handoffPendingArmyMovementToVisualLifecycle(entityId)");
    expect(source).not.toContain('this.clearPendingArmyMovement(entityId, "movement_started")');
  });

  it("keeps target and fallback handles alive after movement-start handoff", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");
    const helperStart = source.indexOf("private handoffPendingArmyMovementToVisualLifecycle(");
    expect(helperStart).toBeGreaterThan(-1);

    const helperEnd = source.indexOf("private clearPendingArmyMovement(", helperStart);
    const helperBody = source.slice(helperStart, helperEnd);

    expect(helperBody).toContain("movement.handedOffToVisuals = true");
    expect(helperBody).toContain('reason: "movement_started"');
    expect(helperBody).toContain("trackedEffect.cleanup()");
    expect(helperBody).not.toContain("this.pendingArmyMovements.delete(entityId)");
    expect(helperBody).not.toContain("clearTimeout");
  });

  it("clears pending movement from authoritative projection changes", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");
    const methodStart = source.indexOf("private handleProjectedArmyChanges(");
    const methodEnd = source.indexOf("private syncProjectedStructurePathfinding(", methodStart);
    const body = source.slice(methodStart, methodEnd);

    expect(source).toContain("private clearPendingArmyMovementFromAuthoritativePosition(");
    expect(body).toContain(
      "this.clearPendingArmyMovementFromAuthoritativePosition({ entityId, hexCoords: current.hexCoords })",
    );
  });

  it("clears retained pending movement handles when visual completion follows authoritative target match", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");
    const lifecycleStart = source.indexOf("private installPendingMovementVisualLifecycle(");
    expect(lifecycleStart).toBeGreaterThan(-1);

    const lifecycleEnd = source.indexOf("private disposePendingMovementVisualLifecycle(", lifecycleStart);
    const lifecycleBody = source.slice(lifecycleStart, lifecycleEnd);
    const completeStart = lifecycleBody.indexOf("const disposeMovementComplete");
    const completeEnd = lifecycleBody.indexOf("const disposeAuthoritativeReconcile", completeStart);
    const completeHandler = lifecycleBody.slice(completeStart, completeEnd);

    expect(completeHandler).toContain("this.completePendingArmyMovementAuthoritativeResolution(entityId)");
    expect(completeHandler.indexOf("this.completePendingArmyMovementAuthoritativeResolution(entityId)")).toBeLessThan(
      completeHandler.indexOf("this.disposePendingMovementVisualLifecycle(entityId)"),
    );
  });

  it("clears retained pending movement handles when visual cancellation replaces completion", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");
    const lifecycleStart = source.indexOf("private installPendingMovementVisualLifecycle(");
    expect(lifecycleStart).toBeGreaterThan(-1);

    const lifecycleEnd = source.indexOf("private disposePendingMovementVisualLifecycle(", lifecycleStart);
    const lifecycleBody = source.slice(lifecycleStart, lifecycleEnd);
    const cancelStart = lifecycleBody.indexOf("const disposeMovementVisualCancel");
    const cancelEnd = lifecycleBody.indexOf("this.pendingArmyMovementVisualLifecycleDisposers.set", cancelStart);
    const cancelHandler = lifecycleBody.slice(cancelStart, cancelEnd);

    expect(cancelHandler).toContain("this.completePendingArmyMovementAuthoritativeResolution(entityId)");
    expect(cancelHandler.indexOf("this.completePendingArmyMovementAuthoritativeResolution(entityId)")).toBeLessThan(
      cancelHandler.indexOf("this.disposePendingMovementVisualLifecycle(entityId)"),
    );
  });

  it("keeps travel effects pending after movement-start handoff retains target handles", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");
    const helperStart = source.indexOf("private hasPendingTravelEffectForHex(");
    expect(helperStart).toBeGreaterThan(-1);

    const helperEnd = source.indexOf("private startPendingActionFx(", helperStart);
    const helperBody = source.slice(helperStart, helperEnd);

    expect(helperBody).toContain("trackedEffect.key === key");
    expect(helperBody).toContain("this.getPendingArmyMovement(entityId)?.movement");
  });

  it("does not register tx hashes after authoritative updates already cleared pending movement", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");
    const txResponseStart = source.indexOf(".then((result: any) => {");
    expect(txResponseStart).toBeGreaterThan(-1);

    const catchStart = source.indexOf(".catch((e) => {", txResponseStart);
    const body = source.slice(txResponseStart, catchStart);
    const pendingGuard = body.indexOf("this.isArmyMovementPending(selectedEntityId)");
    const submittedTxRegistration = body.indexOf(
      "this.handleSubmittedArmyMovementTx({ entityId: selectedEntityId, txHash })",
    );

    expect(pendingGuard).toBeGreaterThan(-1);
    expect(submittedTxRegistration).toBeGreaterThan(-1);
    expect(pendingGuard).toBeLessThan(submittedTxRegistration);
  });

  it("does not apply submitted movement plans after authoritative updates already cleared pending movement", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");
    const applyStart = source.indexOf("private async applySubmittedArmyMovementOptimisticPlan(");
    expect(applyStart).toBeGreaterThan(-1);

    const applyEnd = source.indexOf("private clearArrivalGhostAfterOptimisticMovementAbort(", applyStart);
    const body = source.slice(applyStart, applyEnd);

    expect(body).toContain("if (!this.isArmyMovementPending(entityId)) return");
    expect(body.indexOf("this.isArmyMovementPending(entityId)")).toBeLessThan(
      body.indexOf("this.armyManager.applyMovementPlan"),
    );
  });

  it("keeps the authoritative movement lifecycle installed when optimistic animation is skipped", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");
    const helperStart = source.indexOf("private clearArrivalGhostAfterOptimisticMovementAbort(");
    expect(helperStart).toBeGreaterThan(-1);

    const helperEnd = source.indexOf("private paintOptimisticDestinationBiome(", helperStart);
    const helperBody = source.slice(helperStart, helperEnd);

    expect(helperBody).toContain('"optimistic_animation_skipped"');
    expect(helperBody).toContain('this.arrivalGhostManager.clearArrivalGhost(entityId, "optimistic_aborted")');
    expect(helperBody).not.toContain("this.disposePendingMovementVisualLifecycle(entityId)");
  });

  it("keeps pending movement fallback alive when movement visuals are evicted", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");
    const lifecycleStart = source.indexOf("private installPendingMovementVisualLifecycle(");
    expect(lifecycleStart).toBeGreaterThan(-1);

    const lifecycleEnd = source.indexOf("private disposePendingMovementVisualLifecycle(", lifecycleStart);
    const lifecycleBody = source.slice(lifecycleStart, lifecycleEnd);
    const cancelStart = lifecycleBody.indexOf("const disposeMovementVisualCancel");
    const cancelEnd = lifecycleBody.indexOf("this.pendingArmyMovementVisualLifecycleDisposers.set", cancelStart);
    const cancelHandler = lifecycleBody.slice(cancelStart, cancelEnd);

    expect(cancelHandler).toContain("this.clearEvictedArmyMovementVisuals(entityId)");
    expect(cancelHandler).not.toContain("this.clearPendingArmyMovement");

    const helperStart = source.indexOf("private clearEvictedArmyMovementVisuals(");
    expect(helperStart).toBeGreaterThan(-1);

    const helperEnd = source.indexOf("private handoffPendingArmyMovementToVisualLifecycle(", helperStart);
    const helperBody = source.slice(helperStart, helperEnd);

    expect(helperBody).toContain("trackedEffect.cleanup()");
    expect(helperBody).toContain('this.arrivalGhostManager.clearArrivalGhost(entityId, "movement_evicted")');
    expect(helperBody).not.toContain("pendingArmyMovements.delete");
    expect(helperBody).not.toContain("fallbackTimeout");
  });
});

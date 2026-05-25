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

    expect(helperBody).toContain("this.pendingArmyMovements.delete(entityId)");
    expect(helperBody).toContain('reason: "movement_started"');
    expect(helperBody).toContain("trackedEffect.cleanup()");
    expect(helperBody).not.toContain("this.pendingArmyMovementTargetKeys.delete(entityId)");
    expect(helperBody).not.toContain("this.pendingArmyMovementFallbackTimeouts");
    expect(helperBody).not.toContain("clearTimeout");
  });

  it("clears pending movement from authoritative tile updates after manager reconciliation", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");
    const onTileStart = source.indexOf("this.worldUpdateListener.Army.onTileUpdate(async");
    expect(onTileStart).toBeGreaterThan(-1);

    const nextSubscription = source.indexOf("this.addWorldUpdateSubscription(", onTileStart + 100);
    const body = source.slice(onTileStart, nextSubscription);
    const managerApply = body.indexOf("await this.armyManager.onTileUpdate(update)");
    const pendingClear = body.indexOf("this.clearPendingArmyMovementFromAuthoritativePosition(update)");

    expect(managerApply).toBeGreaterThan(-1);
    expect(pendingClear).toBeGreaterThan(-1);
    expect(managerApply).toBeLessThan(pendingClear);
  });

  it("clears pending movement from authoritative ExplorerTroops updates", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");
    const callStart = source.indexOf("processExplorerTroopsUpdate(update, {");
    expect(callStart).toBeGreaterThan(-1);

    const callEnd = source.indexOf("});", callStart);
    const body = source.slice(callStart, callEnd);

    expect(source).toContain("private clearPendingArmyMovementFromAuthoritativePosition(");
    expect(body).toContain("onAuthoritativePositionApplied:");
    expect(body).toContain("this.clearPendingArmyMovementFromAuthoritativePosition(update)");
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
    expect(helperBody).toContain("this.pendingArmyMovementTargetKeys.has(entityId)");
  });

  it("does not register tx hashes after authoritative updates already cleared pending movement", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");
    const txResponseStart = source.indexOf(".then((result: any) => {");
    expect(txResponseStart).toBeGreaterThan(-1);

    const catchStart = source.indexOf(".catch((e) => {", txResponseStart);
    const body = source.slice(txResponseStart, catchStart);
    const pendingGuard = body.indexOf("this.pendingArmyMovements.has(selectedEntityId)");
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

    const applyEnd = source.indexOf("private mirrorOptimisticArmyDestinationIntoWorldmapCache", applyStart);
    const body = source.slice(applyStart, applyEnd);

    expect(body).toContain("if (!this.pendingArmyMovements.has(entityId)) return");
    expect(body.indexOf("this.pendingArmyMovements.has(entityId)")).toBeLessThan(
      body.indexOf("this.armyManager.applyMovementPlan"),
    );
  });

  it("keeps the authoritative movement lifecycle installed when optimistic animation is skipped", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");
    const helperStart = source.indexOf("private clearArrivalGhostAfterOptimisticMovementAbort(");
    expect(helperStart).toBeGreaterThan(-1);

    const helperEnd = source.indexOf("private mirrorOptimisticArmyDestinationIntoWorldmapCache", helperStart);
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
    expect(helperBody).not.toContain("pendingArmyMovementFallbackTimeouts");
  });
});

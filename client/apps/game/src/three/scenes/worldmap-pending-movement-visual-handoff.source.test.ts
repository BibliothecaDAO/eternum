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
});

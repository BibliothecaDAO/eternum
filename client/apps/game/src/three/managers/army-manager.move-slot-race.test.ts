import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, relativePath), "utf8");
}

describe("ArmyManager move slot race hardening", () => {
  it("tracks per-entity move apply versions", () => {
    const source = readSource("./army-manager.ts");

    expect(source).toContain("private moveApplyVersionByEntity: Map<ID, number> = new Map()");
    expect(source).toContain("private beginMoveApply(entityId: ID): number");
    expect(source).toContain("private isCurrentMoveApply(entityId: ID, version: number): boolean");
  });

  it("re-reads latest army state after async pathfinding before applying presentation state", () => {
    const source = readSource("./army-manager.ts");
    const methodStart = source.indexOf("private async applyMovementWithLatestPresentationState(");

    expect(methodStart).toBeGreaterThan(-1);

    const methodBody = source.slice(methodStart, methodStart + 2200);
    const latestArmyPos = methodBody.indexOf("const latestArmy = this.resolvePostPathMovementState(input.entityId);");

    expect(latestArmyPos).toBeGreaterThan(-1);
  });

  it("aborts stale move applies after await instead of mutating with an older snapshot", () => {
    const source = readSource("./army-manager.ts");
    const moveMethodStart = source.indexOf("public async moveArmy(entityId: ID, hexCoords: Position)");
    const helperStart = source.indexOf("private async applyMovementWithLatestPresentationState(");

    expect(moveMethodStart).toBeGreaterThan(-1);
    expect(helperStart).toBeGreaterThan(-1);

    const moveMethodBody = source.slice(moveMethodStart, moveMethodStart + 1800);
    const helperBody = source.slice(helperStart, helperStart + 2200);

    expect(moveMethodBody).toContain("const moveApplyVersion = this.beginMoveApply(entityId);");
    expect(helperBody).toContain("if (!this.isCurrentMoveApply(input.entityId, input.moveApplyVersion))");
  });

  it("starts movement from the latest matrix slot rather than the pre-await snapshot", () => {
    const source = readSource("./army-manager.ts");
    const methodStart = source.indexOf("private async applyMovementWithLatestPresentationState(");

    expect(methodStart).toBeGreaterThan(-1);

    const methodBody = source.slice(methodStart, methodStart + 2600);
    expect(methodBody).toContain("const matrixIndex = latestArmy.matrixIndex;");
    expect(methodBody).toContain("latestArmy.category");
    expect(methodBody).toContain("latestArmy.tier");
    expect(methodBody).toContain("this.armyModel.startMovement(");
  });

  it("falls back to immediate destination render when the latest slot is gone post-await", () => {
    const source = readSource("./army-manager.ts");
    const methodStart = source.indexOf("private async applyMovementWithLatestPresentationState(");

    expect(methodStart).toBeGreaterThan(-1);

    const methodBody = source.slice(methodStart, methodStart + 2600);
    const latestMatrixPos = methodBody.indexOf("const matrixIndex = latestArmy.matrixIndex;");
    const slotlessBranchPos = methodBody.indexOf("await this.applySlotlessMovementRecovery({");
    const recoveryMethodPos = source.indexOf("private async applySlotlessMovementRecovery(");
    const recoveryBody = source.slice(recoveryMethodPos, recoveryMethodPos + 1200);
    const renderRecoveryPos = recoveryBody.indexOf("await this.renderArmyIntoCurrentChunkIfVisible(input.entityId)");

    expect(latestMatrixPos).toBeGreaterThan(-1);
    expect(slotlessBranchPos).toBeGreaterThan(latestMatrixPos);
    expect(renderRecoveryPos).toBeGreaterThan(-1);
  });
});

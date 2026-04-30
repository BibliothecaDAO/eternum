import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(filename: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, filename), "utf8");
}

describe("ArmyManager optimistic movement wiring", () => {
  it("exposes a public computeMovementPlan seam", () => {
    const source = readSource("army-manager.ts");

    expect(source).toContain("public async computeMovementPlan(entityId: ID, hexCoords: Position)");
    expect(source).toContain("Promise<ArmyMovementPlan | null>");
  });

  it("exposes a public applyMovementPlan seam that accepts optimistic flag", () => {
    const source = readSource("army-manager.ts");

    expect(source).toContain("public async applyMovementPlan(");
    expect(source).toContain("options: { optimistic: boolean }");
  });

  it("keeps moveArmy as a thin wrapper over computeMovementPlan + applyMovementPlan", () => {
    const source = readSource("army-manager.ts");

    const moveArmyStart = source.indexOf("public async moveArmy(entityId: ID, hexCoords: Position)");
    expect(moveArmyStart).toBeGreaterThan(0);
    const nextPublic = source.indexOf("\n  public ", moveArmyStart + 20);
    const moveArmyBody = source.slice(moveArmyStart, nextPublic);
    expect(moveArmyBody).toContain("this.computeMovementPlan(entityId, hexCoords)");
    expect(moveArmyBody).toContain("this.applyMovementPlan(plan");
  });

  it("tracks optimistic armies in a dedicated set", () => {
    const source = readSource("army-manager.ts");

    expect(source).toContain("private optimisticallyMovingArmies: Set<ID>");
    expect(source).toContain("public isArmyMovingOptimistically(entityId: ID): boolean");
  });

  it("exposes a public rewindOptimisticMovement", () => {
    const source = readSource("army-manager.ts");

    expect(source).toContain("public rewindOptimisticMovement(entityId: ID)");
    expect(source).toContain('"optimistic_animation_rewound"');
  });

  it("records optimistic_animation_reconciled when an authoritative update arrives for an optimistic army", () => {
    const source = readSource("army-manager.ts");

    const moveArmyStart = source.indexOf("public async moveArmy(entityId: ID, hexCoords: Position)");
    expect(moveArmyStart).toBeGreaterThan(0);
    const nextPublic = source.indexOf("\n  public ", moveArmyStart + 20);
    const moveArmyBody = source.slice(moveArmyStart, nextPublic);
    expect(moveArmyBody).toContain("this.optimisticallyMovingArmies.has(entityId)");
    expect(moveArmyBody).toContain("this.markOptimisticMovementReconciled(entityId)");

    const reconcileStart = source.indexOf("private markOptimisticMovementReconciled(entityId: ID)");
    expect(reconcileStart).toBeGreaterThan(0);
    const reconcileEnd = source.indexOf("\n  public ", reconcileStart + 20);
    const reconcileBody = source.slice(reconcileStart, reconcileEnd);
    expect(reconcileBody).toContain('"optimistic_animation_reconciled"');
    expect(reconcileBody).toContain("this.optimisticallyMovingArmies.delete(entityId)");
    expect(reconcileBody).toContain("this.optimisticPositionLocks.delete(entityId)");
    expect(reconcileBody).toContain("this.authoritativeReconciledArmies.add(entityId)");
  });

  it("clears optimistic tracking when the authoritative move completes", () => {
    const source = readSource("army-manager.ts");

    expect(source).toMatch(/this\.optimisticallyMovingArmies\.delete\(entityId\)/);
  });

  it("exports the ArmyMovementPlan interface for external consumers", () => {
    const source = readSource("army-manager.ts");

    expect(source).toContain("export interface ArmyMovementPlan");
    expect(source).toContain("path: Position[]");
    expect(source).toContain("worldPath: Vector3[]");
  });
});

describe("ArmyModel cancel seam", () => {
  it("exposes a public cancelMovement to support rewinds without firing completion", () => {
    const source = readSource("army-model.ts");

    expect(source).toContain("public cancelMovement(entityId: number)");
  });
});

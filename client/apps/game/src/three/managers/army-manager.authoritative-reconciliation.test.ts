import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "army-manager.ts"), "utf8");
}

describe("ArmyManager authoritative reconciliation seam", () => {
  it("exposes an onAuthoritativeReconciliation listener alongside movement-complete", () => {
    const source = readSource();

    expect(source).toContain("public onAuthoritativeReconciliation(entityId: ID, callback: () => void): () => void");
    expect(source).toContain("private authoritativeReconcileListeners");
  });

  it("fires reconciliation listeners when an authoritative tile update arrives for an optimistic army", () => {
    const source = readSource();

    const moveArmyStart = source.indexOf("public async moveArmy(entityId: ID, hexCoords: Position)");
    expect(moveArmyStart).toBeGreaterThan(0);
    const body = source.slice(moveArmyStart, moveArmyStart + 900);

    expect(body).toMatch(/optimisticallyMovingArmies\.has\(entityId\)[\s\S]*?markOptimisticMovementReconciled/);
    expect(source).toMatch(/private markOptimisticMovementReconciled[\s\S]*?runAuthoritativeReconcileListeners/);
  });

  it("fires reconciliation listeners when a matching optimistic lock outlives the tween", () => {
    const source = readSource();

    const skipStart = source.indexOf("public shouldSkipStalePositionUpdate(");
    expect(skipStart).toBeGreaterThan(0);
    const body = source.slice(skipStart, skipStart + 1200);
    const targetMatchStart = body.indexOf("if (matchesTarget)");
    expect(targetMatchStart).toBeGreaterThan(0);
    const targetMatchBlock = body.slice(targetMatchStart, targetMatchStart + 350);

    expect(targetMatchBlock).toContain("this.markOptimisticMovementReconciled(entityId");
  });

  it("exposes hasReceivedAuthoritativeReconciliation accessor for gating dequeue", () => {
    const source = readSource();

    expect(source).toContain("public hasReceivedAuthoritativeReconciliation(entityId: ID): boolean");
  });

  it("exposes unresolved optimistic movement state for queueing after tween completion", () => {
    const source = readSource();

    expect(source).toContain("public hasUnresolvedOptimisticMovement(entityId: ID): boolean");
    expect(source).toMatch(/optimisticPositionLocks\.has\(entityId\)/);
  });
});

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

    expect(body).toMatch(/optimisticallyMovingArmies\.has\(entityId\)[\s\S]*?markOptimisticTargetConfirmed/);
    expect(source).toMatch(/private markOptimisticTargetConfirmed[\s\S]*?runAuthoritativeReconcileListeners/);
  });

  it("exposes hasReceivedAuthoritativeReconciliation accessor for gating dequeue", () => {
    const source = readSource();

    expect(source).toContain("public hasReceivedAuthoritativeReconciliation(entityId: ID): boolean");
  });
});

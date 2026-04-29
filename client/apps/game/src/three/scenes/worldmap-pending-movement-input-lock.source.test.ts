import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(filename: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, filename), "utf8");
}

describe("Worldmap pending movement input lock", () => {
  it("blocks onArmyMovement while prior movement is still resolving", () => {
    const source = readSource("worldmap.tsx");

    const start = source.indexOf("private onArmyMovement(account:");
    expect(start).toBeGreaterThan(0);
    const prologue = source.slice(start, start + 900);

    expect(prologue).toContain("this.isArmyMovementInputLocked(selectedEntityId)");
    expect(prologue).toContain("Army movement is still resolving");
    expect(prologue).toContain("this.clearSelection()");

    const lockCheck = prologue.indexOf("this.isArmyMovementInputLocked(selectedEntityId)");
    const affordCheck = prologue.indexOf("this.resolveMovementStaminaForAction");
    expect(lockCheck).toBeGreaterThan(0);
    expect(affordCheck).toBeGreaterThan(lockCheck);
  });

  it("locks movement input for both pending tx state and unresolved optimistic movement", () => {
    const source = readSource("worldmap.tsx");

    const helperStart = source.indexOf("private isArmyMovementInputLocked(entityId: ID)");
    expect(helperStart).toBeGreaterThan(0);
    const helperBody = source.slice(helperStart, helperStart + 500);

    expect(helperBody).toContain("this.pendingArmyMovements.has(entityId)");
    expect(helperBody).toContain("this.armyManager.hasUnresolvedOptimisticMovement(entityId)");
  });

  it("passes unresolved optimistic movement into the selection plan", () => {
    const source = readSource("worldmap.tsx");

    expect(source).toMatch(
      /resolvePendingArmyMovementSelectionPlan\(\{[\s\S]*?isOptimisticMovementActive: this\.armyManager\.hasUnresolvedOptimisticMovement/,
    );
  });
});

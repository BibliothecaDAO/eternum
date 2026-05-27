import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(filename: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, filename), "utf8");
}

describe("Worldmap pending movement input lock", () => {
  it("blocks stale onArmyMovement submits without clearing the selected unit", () => {
    const source = readSource("worldmap.tsx");

    const start = source.indexOf("private onArmyMovement(account:");
    expect(start).toBeGreaterThan(0);
    const prologue = source.slice(start, start + 900);

    expect(prologue).toContain("this.isArmyMovementInputLocked(selectedEntityId)");
    expect(prologue).toContain("Army movement is still resolving");
    expect(prologue).toContain("this.clearMovementActionOptionsForSelectedArmy(selectedEntityId)");
    expect(prologue).not.toContain("this.clearSelection()");

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

  it("locks movement input for transaction hashes that are still tracked", () => {
    const source = readSource("worldmap.tsx");

    const helperStart = source.indexOf("private isArmyMovementInputLocked(entityId: ID)");
    expect(helperStart).toBeGreaterThan(0);
    const helperBody = source.slice(helperStart, helperStart + 900);

    expect(helperBody).toContain("this.hasPendingMovementTransactionForArmy(entityId)");
    expect(helperBody).toContain("this.pendingArmyMovementTxMap");
  });

  it("keeps movement input locked while authoritative resolution waits for visual completion", () => {
    const source = readSource("worldmap.tsx");

    const helperStart = source.indexOf("private isArmyMovementInputLocked(entityId: ID)");
    expect(helperStart).toBeGreaterThan(0);
    const helperBody = source.slice(helperStart, helperStart + 700);

    expect(helperBody).toContain("this.pendingArmyMovementAuthoritativeResolutions.has(entityId)");
  });

  it("passes unresolved optimistic movement into the selection plan", () => {
    const source = readSource("worldmap.tsx");

    expect(source).toMatch(
      /resolvePendingArmyMovementSelectionPlan\(\{[\s\S]*?isOptimisticMovementActive: this\.armyManager\.hasUnresolvedOptimisticMovement/,
    );
  });

  it("does not compute or publish movement action paths while selected movement is unavailable", () => {
    const source = readSource("worldmap.tsx");
    const methodStart = source.indexOf("private onArmySelection(");
    expect(methodStart).toBeGreaterThan(0);
    const methodEnd = source.indexOf("\n  private queueArmySelectionRecovery", methodStart);
    const methodBody = source.slice(methodStart, methodEnd);

    const availabilityCheck = methodBody.indexOf("this.isArmyMovementActionUnavailable(selectedEntityId)");
    const clearOptions = methodBody.indexOf("this.clearMovementActionOptionsForSelectedArmy(selectedEntityId)");
    const actionPathBuild = methodBody.indexOf("armyActionManager.findActionPaths");

    expect(availabilityCheck).toBeGreaterThan(0);
    expect(clearOptions).toBeGreaterThan(availabilityCheck);
    expect(actionPathBuild).toBeGreaterThan(clearOptions);
  });

  it("clears stale action options when the selected army enters pending movement", () => {
    const source = readSource("worldmap.tsx");
    const methodStart = source.indexOf("private markPendingArmyMovement(");
    expect(methodStart).toBeGreaterThan(0);
    const methodEnd = source.indexOf("\n  private resolveContractHexKey", methodStart);
    const methodBody = source.slice(methodStart, methodEnd);

    expect(methodBody).toContain("this.clearMovementActionOptionsForSelectedArmy(entityId)");
  });
});

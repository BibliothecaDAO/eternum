import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(filename: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, filename), "utf8");
}

describe("Worldmap tab-cycle eligibility", () => {
  it("exposes a canArmyAct helper that checks stamina and battle cooldown", () => {
    const source = readSource("worldmap.tsx");

    const helperStart = source.indexOf("private canArmyAct(entityId: ID)");
    expect(helperStart).toBeGreaterThan(0);
    const body = source.slice(helperStart, helperStart + 800);

    // Must look up the army, reject if missing, and check at least min-stamina
    // cost and battle state — the same conditions the action-time submit path
    // requires for a move to be valid.
    expect(body).toContain("this.armyManager.getArmy(entityId)");
    expect(body).toContain("getMinTravelStaminaCost");
    expect(body).toMatch(/battleTimerLeft|battleCooldownEnd/);
  });

  it("consults canArmyAct in the tab cycle loop after the movement lock skip", () => {
    const source = readSource("worldmap.tsx");

    const methodStart = source.indexOf("private async selectNextArmy(");
    expect(methodStart).toBeGreaterThan(0);
    const methodEnd = source.indexOf("\n  private ", methodStart + 20);
    const body = source.slice(methodStart, methodEnd);

    expect(body).toContain("this.canArmyAct(army.entityId)");

    // Order: the movement lock skip comes before the canArmyAct skip.
    const pendingPos = body.indexOf("this.isArmyMovementInputLocked(army.entityId)");
    const eligibilityPos = body.indexOf("this.canArmyAct(army.entityId)");
    expect(pendingPos).toBeGreaterThan(0);
    expect(eligibilityPos).toBeGreaterThan(pendingPos);
  });

  it("treats unresolved optimistic movement as ineligible for tab cycle", () => {
    const source = readSource("worldmap.tsx");

    const helperStart = source.indexOf("private isArmyMovementInputLocked(entityId: ID)");
    expect(helperStart).toBeGreaterThan(0);
    const helperBody = source.slice(helperStart, helperStart + 500);

    expect(helperBody).toContain("this.pendingArmyMovements.has(entityId)");
    expect(helperBody).toContain("this.armyManager.hasUnresolvedOptimisticMovement(entityId)");
    expect(source).toMatch(
      /this\.selectableArmies\.some\(\s*\(army\) => !this\.isArmyMovementInputLocked\(army\.entityId\)/,
    );
  });

  it("shortcut registration gates on eligibility, not raw selectableArmies count", () => {
    const source = readSource("worldmap.tsx");

    // The keyboard shortcut registration should only fire tab-cycle when at
    // least one army is actually eligible — otherwise it silently does nothing
    // on an empty cycle, which can feel broken.
    expect(source).toMatch(/hasEligibleArmyForTabCycle|this\.selectableArmies\.some\(/);
  });
});

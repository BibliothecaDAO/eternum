import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(filename: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, filename), "utf8");
}

describe("Worldmap movement stamina wiring", () => {
  it("captures the movement tick before resolving submit affordability", () => {
    const source = readSource("worldmap.tsx");
    const start = source.indexOf("private onArmyMovement(account:");
    expect(start).toBeGreaterThan(0);
    const prologue = source.slice(start, start + 1_500);

    expect(prologue).toContain("const currentArmiesTick = getBlockTimestamp().currentArmiesTick");
    expect(prologue).toContain("const movementStamina = this.resolveMovementStaminaForAction");
    expect(prologue).toContain("!movementStamina.canAfford");
    expect(prologue).toContain("this.logBlockedMovementStamina");
    expect(prologue).not.toContain("!this.canAffordMove");
  });

  it("seeds pending stamina from the same resolved submit snapshot", () => {
    const source = readSource("worldmap.tsx");
    const movementStart = source.indexOf("private onArmyMovement(account:");
    expect(movementStart).toBeGreaterThan(0);
    const movementEnd = source.indexOf("\n  private onArmyAttack", movementStart);
    expect(movementEnd).toBeGreaterThan(movementStart);
    const movementBody = source.slice(movementStart, movementEnd);

    expect(movementBody).toMatch(/currentStamina: movementStamina\.currentStamina/);
    expect(movementBody).toMatch(/staminaCost: movementStamina\.staminaCost/);
    expect(movementBody).not.toContain("currentStamina: selectedArmy.currentStamina");
  });

  it("clears pending stamina when movement submit fails", () => {
    const source = readSource("worldmap.tsx");
    const catchStart = source.indexOf(".catch((e) => {");
    expect(catchStart).toBeGreaterThan(0);
    const catchBody = source.slice(catchStart, catchStart + 900);

    expect(catchBody).toContain("useArmyStaminaSourceStore.getState().clearPendingStaminaSource(selectedEntityId)");
  });
});

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "army-manager.ts"), "utf8");
}

describe("ArmyManager optimistic position lock", () => {
  it("exposes an optimisticPositionLocks map keyed per entity with normalizedTarget + lockedAtMs", () => {
    const source = readSource();

    const fieldStart = source.indexOf("private optimisticPositionLocks: Map<");
    expect(fieldStart).toBeGreaterThan(0);
    const declaration = source.slice(fieldStart, fieldStart + 500);
    expect(declaration).toContain("normalizedTarget");
    expect(declaration).toContain("lockedAtMs");
  });

  it("exposes a public shouldSkipStalePositionUpdate predicate", () => {
    const source = readSource();

    expect(source).toContain(
      "public shouldSkipStalePositionUpdate(entityId: ID, incomingNormalized: { x: number; y: number }): boolean",
    );
  });

  it("defines a LOCK_TTL_MS constant for the auto-release window", () => {
    const source = readSource();

    expect(source).toMatch(/LOCK_TTL_MS\s*=\s*15[_\d]*/);
  });

  it("writes the lock inside applyMovementPlan when the optimistic flag is set", () => {
    const source = readSource();

    const methodStart = source.indexOf("public async applyMovementPlan(");
    expect(methodStart).toBeGreaterThan(0);
    const methodEnd = source.indexOf("\n  public ", methodStart + 20);
    const body = source.slice(methodStart, methodEnd);

    expect(body).toMatch(/optimisticPositionLocks\.set\(entityId/);
    expect(body).toContain("targetNormalized");
  });

  it("guards onTileUpdate with the skip predicate before moveArmy/addArmy", () => {
    const source = readSource();

    const methodStart = source.indexOf("async onTileUpdate(update: ExplorerTroopsTileSystemUpdate)");
    expect(methodStart).toBeGreaterThan(0);
    const prologue = source.slice(methodStart, methodStart + 700);

    expect(prologue).toContain("this.shouldSkipStalePositionUpdate");
  });

  it("clears the lock on rewindOptimisticMovement", () => {
    const source = readSource();

    const methodStart = source.indexOf("public rewindOptimisticMovement(entityId: ID)");
    expect(methodStart).toBeGreaterThan(0);
    const body = source.slice(methodStart, methodStart + 1200);

    expect(body).toContain("this.optimisticPositionLocks.delete(entityId)");
  });

  it("clears the lock map on destroy", () => {
    const source = readSource();

    expect(source).toContain("this.optimisticPositionLocks.clear()");
  });
});

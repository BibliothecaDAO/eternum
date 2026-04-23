import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "army-manager.ts"), "utf8");
}

/**
 * Discovery-revert coverage. `explorer_explore` on a tile that rolls a treasure
 * (Camp, Mine, Hyperstructure, …) sets `occupy_destination = false` and reverts
 * `explorer.coord = from` on-chain (troop_movement.cairo:193). The optimistic
 * lock must recognise this by treating an incoming position that matches the
 * locked source — not just the target — as a valid authoritative update, so
 * the visual can reconcile back to `from` instead of staying stuck on the
 * camp tile until the TTL expires.
 */
describe("ArmyManager optimistic revert-on-source", () => {
  it("stores normalizedSource alongside normalizedTarget in the lock type", () => {
    const source = readSource();

    const fieldStart = source.indexOf("private optimisticPositionLocks: Map<");
    expect(fieldStart).toBeGreaterThan(0);
    const declaration = source.slice(fieldStart, fieldStart + 500);
    expect(declaration).toContain("normalizedSource");
    expect(declaration).toContain("normalizedTarget");
  });

  it("applyMovementPlan writes both sourceNormalized and targetNormalized into the lock", () => {
    const source = readSource();

    const methodStart = source.indexOf("public async applyMovementPlan(");
    expect(methodStart).toBeGreaterThan(0);
    const methodEnd = source.indexOf("\n  public ", methodStart + 20);
    const body = source.slice(methodStart, methodEnd);

    const setCallStart = body.indexOf("optimisticPositionLocks.set(entityId");
    expect(setCallStart).toBeGreaterThan(-1);
    const setCall = body.slice(setCallStart, setCallStart + 400);
    expect(setCall).toContain("normalizedSource");
    expect(setCall).toContain("sourceNormalized");
    expect(setCall).toContain("normalizedTarget");
    expect(setCall).toContain("targetNormalized");
  });

  it("shouldSkipStalePositionUpdate releases the lock and returns false when incoming matches normalizedSource", () => {
    const source = readSource();

    const methodStart = source.indexOf(
      "public shouldSkipStalePositionUpdate(entityId: ID, incomingNormalized: { x: number; y: number }): boolean",
    );
    expect(methodStart).toBeGreaterThan(0);
    const methodEnd = source.indexOf("\n  public ", methodStart + 20);
    const body = source.slice(methodStart, methodEnd);

    expect(body).toContain("normalizedSource");
    // The source-match path must release the lock before returning false,
    // mirroring the existing target-match path.
    expect(body).toMatch(/normalizedSource[\s\S]{0,400}?optimisticPositionLocks\.delete\(entityId\)/);
  });
});

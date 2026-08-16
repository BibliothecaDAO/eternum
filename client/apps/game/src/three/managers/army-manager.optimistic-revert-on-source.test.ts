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
 * lock must recognise this without immediately accepting a stale echo from a
 * preceding move. Source matches are held briefly and only rewind when no
 * matching target update arrives during the hold.
 */
describe("ArmyManager optimistic revert-on-source", () => {
  it("stores normalizedSource alongside normalizedTarget in the lock type", () => {
    const source = readSource();

    const typeStart = source.indexOf("interface OptimisticPositionLock");
    expect(typeStart).toBeGreaterThan(0);
    const declaration = source.slice(typeStart, typeStart + 300);
    expect(declaration).toContain("normalizedSource");
    expect(declaration).toContain("normalizedTarget");
    expect(source).toContain("private optimisticPositionLocks: Map<ID, OptimisticPositionLock>");
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

  it("shouldSkipStalePositionUpdate defers an incoming normalizedSource match", () => {
    const source = readSource();

    const methodStart = source.indexOf(
      "public shouldSkipStalePositionUpdate(entityId: ID, incomingNormalized: { x: number; y: number }): boolean",
    );
    expect(methodStart).toBeGreaterThan(0);
    const methodEnd = source.indexOf("\n  public ", methodStart + 20);
    const body = source.slice(methodStart, methodEnd);

    expect(body).toContain("normalizedSource");
    expect(body).toContain("this.deferSourceMatchRewind(entityId, incomingNormalized, lock)");
    expect(body).toMatch(/matchesSource[\s\S]{0,500}?return true/);
  });

  it("honors the source match only after the hold window", () => {
    const source = readSource();

    const methodStart = source.indexOf("private deferSourceMatchRewind(");
    expect(methodStart).toBeGreaterThan(0);
    const methodEnd = source.indexOf("\n  private clearDeferredSourceMatch", methodStart + 20);
    const body = source.slice(methodStart, methodEnd);

    expect(body).toContain("OPTIMISTIC_SOURCE_MATCH_HOLD_MS");
    expect(body).toContain('"source_match_honored"');
    expect(body.indexOf("this.runMovementVisualCancelListeners")).toBeLessThan(
      body.indexOf("this.rewindOptimisticMovement(entityId)"),
    );
    expect(body).toContain("this.rewindOptimisticMovement(entityId)");
  });

  it("discards a held source echo when the target follows", () => {
    const source = readSource();

    const methodStart = source.indexOf(
      "public shouldSkipStalePositionUpdate(entityId: ID, incomingNormalized: { x: number; y: number }): boolean",
    );
    expect(methodStart).toBeGreaterThan(0);
    const methodEnd = source.indexOf("\n  public ", methodStart + 20);
    const body = source.slice(methodStart, methodEnd);

    const targetBlock = body.slice(body.indexOf("matchesTarget"), body.indexOf("matchesSource"));
    expect(targetBlock).not.toContain("rewindOptimisticMovement");
    expect(targetBlock).toContain('"source_match_discarded_stale"');
    expect(targetBlock).toContain("this.clearDeferredSourceMatch(lock)");
  });
});

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(filename: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, filename), "utf8");
}

// At tx submission the worldmap writes the optimistic destination into two
// caches: the 3D mesh (armyManager.applyMovementPlan) and the spatial index
// (this.updateArmyHexes — "cache mirror"). Rewinds must unwind BOTH layers,
// otherwise the mesh snaps back to source while armyHexes keeps the army
// pinned at destination, producing a clickable-but-invisible hex at dest and
// a visible-but-unclickable mesh at source.
describe("Worldmap rewind seam (armyManager + armyHexes)", () => {
  it("defines a private seam that rewinds both layers atomically", () => {
    const source = readSource("worldmap.tsx");

    const seamStart = source.indexOf("private rewindOptimisticMovementAndArmyHexes(entityId: ID)");
    expect(seamStart).toBeGreaterThan(0);

    // Grab a generous slice covering the method body.
    const seamBody = source.slice(seamStart, seamStart + 2000);

    // Must guard so a no-op caller doesn't dispatch empty spatial writes.
    expect(seamBody).toContain("hasUnresolvedOptimisticMovement(entityId)");
    // Must call the armyManager rewind for the visual layer.
    expect(seamBody).toContain("this.armyManager.rewindOptimisticMovement(entityId)");
    // Must mirror the rewound source into the spatial index.
    expect(seamBody).toContain("this.updateArmyHexes(");
    // Must read owner metadata from the tracked army so updateArmyHexes
    // receives a usable ownerAddress (undefined triggers its early-return).
    expect(seamBody).toContain("this.armyManager.getArmy(entityId)");
  });

  it("consumes the normalized source returned by rewindOptimisticMovement", () => {
    const source = readSource("worldmap.tsx");
    const seamStart = source.indexOf("private rewindOptimisticMovementAndArmyHexes(entityId: ID)");
    const seamBody = source.slice(seamStart, seamStart + 2000);

    // The rewind method now returns the locked source coords (col/row) so the
    // seam doesn't have to infer them from internal armyManager state that
    // may not be populated for same-bucket moves.
    expect(seamBody).toMatch(/const source = this\.armyManager\.rewindOptimisticMovement\(entityId\)/);
    expect(seamBody).toMatch(/col:\s*source\.col/);
    expect(seamBody).toMatch(/row:\s*source\.row/);
  });

  it("routes handleTransactionFailed through the seam", () => {
    const source = readSource("worldmap.tsx");
    const handlerStart = source.indexOf("this.handleTransactionFailed = ");
    expect(handlerStart).toBeGreaterThan(0);
    const handlerEnd = source.indexOf("};", handlerStart);
    expect(handlerEnd).toBeGreaterThan(handlerStart);
    const handler = source.slice(handlerStart, handlerEnd);

    expect(handler).toContain("this.rewindOptimisticMovementAndArmyHexes(plan.entityId)");
    // And must no longer call the raw armyManager rewind from the callsite.
    expect(handler).not.toContain("this.armyManager.rewindOptimisticMovement(");
  });

  it("routes the tx-submission catch through the seam", () => {
    const source = readSource("worldmap.tsx");
    // Anchor near the .catch() inside onArmyMovement where the tx-submit
    // failure path is handled.
    const catchMarker = "// Transaction failed at submission, remove from pending and cleanup";
    const catchStart = source.indexOf(catchMarker);
    expect(catchStart).toBeGreaterThan(0);
    const catchBody = source.slice(catchStart, catchStart + 1200);

    expect(catchBody).toContain("this.rewindOptimisticMovementAndArmyHexes(selectedEntityId)");
    expect(catchBody).not.toContain("this.armyManager.rewindOptimisticMovement(");
  });

  it("routes the fallback timeout through the seam", () => {
    const source = readSource("worldmap.tsx");
    const fallbackStart = source.indexOf("private schedulePendingArmyMovementFallback(");
    expect(fallbackStart).toBeGreaterThan(0);
    const fallbackEnd = source.indexOf("\n  }\n", fallbackStart);
    expect(fallbackEnd).toBeGreaterThan(fallbackStart);
    const fallbackBody = source.slice(fallbackStart, fallbackEnd);

    expect(fallbackBody).toContain("this.rewindOptimisticMovementAndArmyHexes(entityId)");
    expect(fallbackBody).not.toContain("this.armyManager.rewindOptimisticMovement(");
  });
});

describe("ArmyManager.rewindOptimisticMovement returns locked source", () => {
  it("reads normalizedSource from the lock before deleting it", () => {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(resolve(currentDir, "../managers/army-manager.ts"), "utf8");

    const methodStart = source.indexOf("public rewindOptimisticMovement(entityId: ID)");
    expect(methodStart).toBeGreaterThan(0);
    const methodEnd = source.indexOf("\n  }\n", methodStart);
    expect(methodEnd).toBeGreaterThan(methodStart);
    const body = source.slice(methodStart, methodEnd);

    // Signature must advertise the returned source (or null) so worldmap
    // callers can pair the visual rewind with an armyHexes update.
    expect(body).toMatch(
      /public rewindOptimisticMovement\(entityId: ID\):\s*\{\s*col: number;\s*row: number;?\s*\}\s*\|\s*null/,
    );

    // The read must happen BEFORE optimisticPositionLocks.delete, else we
    // can't recover the source once the lock is cleared.
    const lockRead = body.indexOf("this.optimisticPositionLocks.get(entityId)");
    const lockDelete = body.indexOf("this.optimisticPositionLocks.delete(entityId)");
    expect(lockRead).toBeGreaterThan(0);
    expect(lockDelete).toBeGreaterThan(lockRead);

    // Early return when neither the tween nor its unresolved lock exists keeps
    // the seam a no-op for idle entities.
    expect(body).toMatch(/if \(!this\.optimisticallyMovingArmies\.has\(entityId\) && !lock\) return null/);
  });
});

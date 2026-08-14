import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const readWorldmap = () => readFileSync(resolve(currentDir, "worldmap.tsx"), "utf8");
const readManager = () => readFileSync(resolve(currentDir, "../managers/army-manager.ts"), "utf8");

describe("worldmap optimistic rewind seam", () => {
  it("rewinds presentation state without writing a second spatial truth", () => {
    const source = readWorldmap();
    const methodStart = source.indexOf("private rewindOptimisticMovement(entityId: ID)");
    const methodEnd = source.indexOf("private onArmySelection(", methodStart);
    const body = source.slice(methodStart, methodEnd);

    expect(body).toContain("this.armyManager.hasUnresolvedOptimisticMovement(entityId)");
    expect(body).toContain("this.armyManager.rewindOptimisticMovement(entityId)");
    expect(body).not.toContain("armyHexes");
    expect(body).not.toContain("worldSpatialProjection");
  });

  it("routes transaction failure and stale timeout through the rewind seam", () => {
    const source = readWorldmap();

    expect(source).toContain("this.rewindOptimisticMovement(plan.entityId)");
    expect(source).toContain("this.rewindOptimisticMovement(selectedEntityId)");
    expect(source).toContain("this.rewindOptimisticMovement(entityId)");
    expect(source).not.toContain("rewindOptimisticMovementAndArmyHexes");
  });

  it("uses the lock source to restore only the bounded presentation", () => {
    const source = readManager();
    const methodStart = source.indexOf("public rewindOptimisticMovement(entityId: ID): void");
    const methodEnd = source.indexOf("public onMovementStart", methodStart);
    const body = source.slice(methodStart, methodEnd);
    const lockRead = body.indexOf("this.optimisticPositionLocks.get(entityId)");
    const lockDelete = body.indexOf("this.optimisticPositionLocks.delete(entityId)");

    expect(lockRead).toBeGreaterThan(-1);
    expect(lockDelete).toBeGreaterThan(lockRead);
    expect(body).toContain("this.armyPresentations.set(entityId");
  });
});

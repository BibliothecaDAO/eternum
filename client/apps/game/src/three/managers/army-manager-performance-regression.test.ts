import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readArmyManagerSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "army-manager.ts"), "utf8");
}

describe("army manager performance regressions", () => {
  it("keeps chunk reconcile off linear visible-order membership scans", () => {
    const source = readArmyManagerSource();

    expect(source).not.toContain("this.visibleArmyOrder.includes(");
    expect(source).not.toContain("this.visibleArmyOrder.indexOf(");
  });

  it("rebuilds model info without sorting visible armies", () => {
    const source = readArmyManagerSource();

    expect(source).not.toContain("const sortedVisibleArmies = visibleArmies.toSorted");
    expect(source).not.toContain("collectModelInfo(sortedVisibleArmies)");
  });

  it("indexes armies by owning structure for targeted owner sync", () => {
    const source = readArmyManagerSource();

    expect(source).toMatch(/private\s+armiesByOwningStructure:\s*Map<ID,\s*Set<ID>>\s*=\s*new Map\(\)/);
    expect(source).toMatch(/public\s+getArmiesForStructure\s*\(\s*structureId:\s*ID\s*\)/);
    expect(source).toMatch(
      /public\s+syncAttachedArmiesOwnerForStructure[\s\S]*const\s+attachedArmyIds\s*=\s*this\.armiesByOwningStructure\.get\(params\.structureId\)/,
    );
  });

  it("batches visible owner-sync uploads across attached armies", () => {
    const source = readArmyManagerSource();

    expect(source).toMatch(
      /public\s+syncAttachedArmiesOwnerForStructure[\s\S]*const\s+visibleArmiesToRefresh:\s*ArmyData\[\]\s*=\s*\[\]/,
    );
    expect(source).toMatch(
      /public\s+syncAttachedArmiesOwnerForStructure[\s\S]*this\.syncTrackedArmyOwnerState\(\s*\{[\s\S]*deferVisibleRefresh:\s*true[\s\S]*\}\s*\)/,
    );
    expect(source).toMatch(
      /public\s+syncAttachedArmiesOwnerForStructure[\s\S]*this\.flushDirtyArmyModelUpdates\(\)/,
    );
  });

  it("compacts visible army slots instead of leaving sparse high-water gaps", () => {
    const source = readArmyManagerSource();

    expect(source).toMatch(/private\s+visibleArmySlotOwners:\s*Map<number,\s*ID>\s*=\s*new Map\(\)/);
    expect(source).toContain("this.armyModel.moveEntityToSlot(");
  });

  it("applies fixed chunk bounds to moving-army point renderers", () => {
    const source = readArmyManagerSource();

    expect(source).toContain("renderer.setWorldBounds(this.currentChunkBounds)");
    expect(source).toMatch(/public\s+setChunkBounds\s*\(\s*bounds\?:\s*\{\s*box:\s*Box3;\s*sphere:\s*Sphere\s*\}\s*\)/);
  });

  it("recomputes battle timers from an active timer set instead of scanning all armies", () => {
    const source = readArmyManagerSource();

    expect(source).toMatch(/private\s+armiesWithActiveBattleTimers:\s*Set<ID>\s*=\s*new Set\(\)/);
    expect(source).toMatch(/for\s*\(\s*const\s+entityId\s+of\s+this\.armiesWithActiveBattleTimers\s*\)/);
    expect(source).not.toMatch(/private\s+recomputeBattleTimersForAllArmies[\s\S]*this\.armies\.forEach/);
  });

  it("tracks dirty attached armies and updates attachment transforms outside the full visible-army loop", () => {
    const source = readArmyManagerSource();

    expect(source).toMatch(/private\s+dirtyAttachedArmyEntities:\s*Set<number>\s*=\s*new Set\(\)/);
    expect(source).toMatch(/private\s+markAttachedArmyTransformDirty\s*\(/);
    expect(source).toMatch(/private\s+updateDirtyArmyAttachmentTransforms\s*\(/);
    expect(source).not.toMatch(/private\s+updateVisibleArmiesBatched[\s\S]*resolveArmyMountTransforms/);
  });

  it("flushes dirty army model uploads instead of global instance uploads during chunk reconcile", () => {
    const source = readArmyManagerSource();

    expect(source).toMatch(/this\.armyModel\.flushDirtyModelUpdates\(\)/);
    expect(source).not.toMatch(/if\s*\(buffersDirty\)\s*\{[\s\S]*this\.armyModel\.updateAllInstances\(\)[\s\S]*this\.armyModel\.computeBoundingSphere\(\)/);
  });
});

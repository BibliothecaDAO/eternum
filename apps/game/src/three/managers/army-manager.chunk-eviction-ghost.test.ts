import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, relativePath), "utf8");
}

describe("chunk-eviction ghosting prevention", () => {
  describe("isArmyVisible does not use stale instanceData.position after eviction", () => {
    it("only reads getEntityWorldPosition when the model owns a live slot", () => {
      const src = readSource("army-manager.ts");

      const methodStart = src.indexOf("private isArmyVisible(");
      expect(methodStart).toBeGreaterThan(-1);

      const methodBody = src.slice(methodStart, methodStart + 1200);

      // The model's slot registry is the single source of render ownership.
      expect(methodBody).toContain("this.armyModel.getEntitySlot(entityIdNumber) !== undefined");
      // The call must remain conditional on model ownership.
      expect(methodBody).toContain("isActivelyRendered");
    });

    it("falls back to army.hexCoords when the model has no live slot", () => {
      const src = readSource("army-manager.ts");

      const methodStart = src.indexOf("private isArmyVisible(");
      expect(methodStart).toBeGreaterThan(-1);

      const methodBody = src.slice(methodStart, methodStart + 1200);

      // When worldPos is falsy (army evicted), it falls to lastKnown or hexCoords
      expect(methodBody).toContain("army.hexCoords.getNormalized()");
    });
  });

  describe("removeVisibleArmy cleans up movement source bucket", () => {
    it("removes the path line before freeing the slot kills the movement-complete callback", () => {
      const src = readSource("army-manager.ts");

      const methodStart = src.indexOf("private removeVisibleArmy(");
      expect(methodStart).toBeGreaterThan(-1);

      const methodBody = src.slice(methodStart, methodStart + 2800);

      const removePathPos = methodBody.indexOf("this.pathRenderer.removePath(numericId)");
      const freeSlotPos = methodBody.indexOf("this.armyModel.freeInstanceSlot(");

      // Eviction is the only teardown that loses the movement-complete callback
      // (the normal path-line eraser); without this call the line is stranded.
      expect(removePathPos).toBeGreaterThan(-1);
      expect(freeSlotPos).toBeGreaterThan(-1);
      expect(removePathPos).toBeLessThan(freeSlotPos);
    });

    it("calls cleanupMovementSourceBucket before freeInstanceSlot", () => {
      const src = readSource("army-manager.ts");

      const methodStart = src.indexOf("private removeVisibleArmy(");
      expect(methodStart).toBeGreaterThan(-1);

      const methodBody = src.slice(methodStart, methodStart + 2000);

      const cleanupPos = methodBody.indexOf("this.cleanupMovementSourceBucket(entityId)");
      const freeSlotPos = methodBody.indexOf("this.armyModel.freeInstanceSlot(");

      expect(cleanupPos).toBeGreaterThan(-1);
      expect(freeSlotPos).toBeGreaterThan(-1);

      // cleanup must happen before freeInstanceSlot (which kills the movement callback)
      expect(cleanupPos).toBeLessThan(freeSlotPos);
    });

    it("notifies movement visual cancellation when chunk reconciliation evicts a moving army", () => {
      const src = readSource("army-manager.ts");

      const methodStart = src.indexOf("private removeVisibleArmy(");
      expect(methodStart).toBeGreaterThan(-1);

      const methodBody = src.slice(methodStart, methodStart + 2800);

      const movingCheckPos = methodBody.indexOf("this.armyModel.isEntityMoving(numericId)");
      const cancelPos = methodBody.indexOf("this.runMovementVisualCancelListeners(numericId)");
      const freeSlotPos = methodBody.indexOf("this.armyModel.freeInstanceSlot(");
      const removeArmyPos = src.indexOf("this.removeVisibleArmy(entityId, { notifyMovementVisualCancel: true })");

      expect(src).toContain("public onMovementVisualCancel(entityId: ID, callback: () => void): () => void");
      expect(src).toContain("options?: { notifyMovementVisualCancel?: boolean }");
      expect(movingCheckPos).toBeGreaterThan(-1);
      expect(cancelPos).toBeGreaterThan(-1);
      expect(freeSlotPos).toBeGreaterThan(-1);
      expect(removeArmyPos).toBeGreaterThan(-1);
      expect(cancelPos).toBeLessThan(freeSlotPos);
    });

    it("routes real army removals through movement cancellation instead of movement completion", () => {
      const src = readSource("army-manager.ts");

      const methodStart = src.indexOf("public removeArmy(");
      expect(methodStart).toBeGreaterThan(-1);

      const methodBody = src.slice(methodStart, methodStart + 2800);
      const removeVisibleArmyPos = methodBody.indexOf(
        "this.removeVisibleArmy(entityId, { notifyMovementVisualCancel: true })",
      );
      const completePos = methodBody.indexOf("this.runMovementCompleteListeners(numericEntityId)");
      const nullSlotCancelPos = methodBody.indexOf("this.runMovementVisualCancelListeners(numericEntityId)");

      expect(removeVisibleArmyPos).toBeGreaterThan(-1);
      expect(completePos).toBe(-1);
      expect(nullSlotCancelPos).toBeGreaterThan(-1);
      expect(nullSlotCancelPos).toBeGreaterThan(removeVisibleArmyPos);
    });
  });
});

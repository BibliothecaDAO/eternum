import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, relativePath), "utf8");
}

// The reported ghost (frozen duplicate at a unit's OLD position after it moves)
// comes from the move-start path seeding the army-model's source-of-truth slot
// (instanceData.matrixIndex) from the army-manager's stale *mirror*
// (ArmyData.matrixIndex). These guards lock in the two manager-side rules that,
// together with the army-model fixes, keep the slot a single source of truth.
describe("ArmyManager movement uses the model's live slot, not the cached mirror", () => {
  it("applyMovementPlan sources the move slot from the army-model SSOT (getEntitySlot)", () => {
    const src = readSource("army-manager.ts");

    const start = src.indexOf("public async applyMovementPlan");
    expect(start).toBeGreaterThan(-1);

    const body = src.slice(start, start + 3200);

    // Must consult the model's live slot rather than blindly trusting the mirror.
    expect(body).toContain("getEntitySlot");
    // The mirror is allowed only as a fallback (?? armyData.matrixIndex).
    expect(body).toMatch(/getEntitySlot\([^)]*\)\s*\?\?\s*armyData\.matrixIndex/);
  });

  it("compactVisibleArmySlots mirrors only the slot moveInstanceSlot actually took", () => {
    const src = readSource("army-manager.ts");

    const start = src.indexOf("private compactVisibleArmySlots");
    expect(start).toBeGreaterThan(-1);

    const body = src.slice(start, start + 1000);

    // The reassignment must capture moveInstanceSlot's resulting slot...
    expect(body).toMatch(/const \w+ = this\.armyModel\.moveInstanceSlot\(/);
    // ...guard the no-slot case...
    expect(body).toContain("=== undefined");
    // ...and must NOT mirror the *planned* toSlot unconditionally.
    expect(body).not.toContain("matrixIndex: toSlot");
    expect(body).not.toContain("this.visibleArmyIndices.set(entityId, toSlot)");
  });
});

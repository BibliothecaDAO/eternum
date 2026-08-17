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
// from a stale ArmyData mirror. ArmyData no longer carries render slots.
describe("ArmyManager uses the army-model as the render-slot truth", () => {
  it("projection-driven movement sources the move slot from the army-model SSOT (getEntitySlot)", () => {
    const src = readSource("army-manager.ts");

    const start = src.indexOf("private async applyMovementPlan");
    expect(start).toBeGreaterThan(-1);

    const body = src.slice(start, start + 3200);

    expect(body).toContain("getEntitySlot");
    expect(body).not.toContain(["armyData", "matrixIndex"].join("."));
  });

  it("compactVisibleArmySlots does not write a slot into ArmyData", () => {
    const src = readSource("army-manager.ts");

    const start = src.indexOf("private compactVisibleArmySlots");
    expect(start).toBeGreaterThan(-1);

    const body = src.slice(start, start + 1000);

    expect(body).toMatch(/const \w+ = this\.armyModel\.moveInstanceSlot\(/);
    expect(body).toContain("=== undefined");
    expect(body).not.toContain("matrixIndex:");
    expect(body).not.toContain("this.visibleArmyIndices.set(entityId, toSlot)");
  });
});

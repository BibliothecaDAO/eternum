import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, relativePath), "utf8");
}

describe("ArmyModel deferred bounds", () => {
  it("updateVisibleArmyBuffers calls requestBoundsUpdate instead of direct computeBoundingSphere", () => {
    const source = readSource("./army-manager.ts");

    // Extract the updateVisibleArmyBuffers method body
    const methodMatch = source.match(/private updateVisibleArmyBuffers\(\):\s*void\s*\{([\s\S]*?)\n  \}/);
    expect(methodMatch).not.toBeNull();
    const methodBody = methodMatch![1];

    // Should use the deferred pattern
    expect(methodBody).toContain("requestBoundsUpdate()");
    expect(methodBody).toContain("applyPendingBounds()");

    // Should NOT directly call computeBoundingSphere on armyModel
    // (playerIndicatorManager.computeBoundingSphere is fine, but armyModel should use deferred)
    expect(methodBody).not.toContain("this.armyModel.computeBoundingSphere()");
  });

  it("applyPendingBounds calls computeBoundingSphere only when pending", () => {
    const source = readSource("./army-model.ts");

    // Find applyPendingBounds method
    const methodStart = source.indexOf("applyPendingBounds(): void");
    expect(methodStart).toBeGreaterThan(-1);

    const bodyAfterMethod = source.substring(methodStart, methodStart + 200);

    // Must check hasPendingBounds before computing
    const pendingCheckIdx = bodyAfterMethod.indexOf("this.hasPendingBounds");
    const computeIdx = bodyAfterMethod.indexOf("this.computeBoundingSphere()");

    expect(pendingCheckIdx).toBeGreaterThan(-1);
    expect(computeIdx).toBeGreaterThan(-1);
    expect(pendingCheckIdx).toBeLessThan(computeIdx);
  });

  it("requestBoundsUpdate sets hasPendingBounds flag", () => {
    const source = readSource("./army-model.ts");

    // Find requestBoundsUpdate method
    const methodStart = source.indexOf("requestBoundsUpdate(): void");
    expect(methodStart).toBeGreaterThan(-1);

    const bodyAfterMethod = source.substring(methodStart, methodStart + 100);

    expect(bodyAfterMethod).toContain("this.hasPendingBounds = true");
  });

  it("bounds are applied after updateAllInstances in updateVisibleArmyBuffers", () => {
    const source = readSource("./army-manager.ts");

    // Find updateVisibleArmyBuffers and verify ordering
    const methodStart = source.indexOf("private updateVisibleArmyBuffers()");
    expect(methodStart).toBeGreaterThan(-1);

    const bodyAfterMethod = source.substring(methodStart);

    const updateAllIdx = bodyAfterMethod.indexOf("updateAllInstances()");
    const requestBoundsIdx = bodyAfterMethod.indexOf("requestBoundsUpdate()");
    const applyBoundsIdx = bodyAfterMethod.indexOf("applyPendingBounds()");

    expect(updateAllIdx).toBeGreaterThan(-1);
    expect(requestBoundsIdx).toBeGreaterThan(-1);
    expect(applyBoundsIdx).toBeGreaterThan(-1);

    // Ordering: updateAllInstances → requestBoundsUpdate → applyPendingBounds
    expect(updateAllIdx).toBeLessThan(requestBoundsIdx);
    expect(requestBoundsIdx).toBeLessThan(applyBoundsIdx);
  });

  it("applyPendingBounds resets flag after compute", () => {
    const source = readSource("./army-model.ts");

    // Find applyPendingBounds method
    const methodStart = source.indexOf("applyPendingBounds(): void");
    expect(methodStart).toBeGreaterThan(-1);

    const bodyAfterMethod = source.substring(methodStart, methodStart + 200);

    const computeIdx = bodyAfterMethod.indexOf("this.computeBoundingSphere()");
    const resetIdx = bodyAfterMethod.indexOf("this.hasPendingBounds = false");

    expect(computeIdx).toBeGreaterThan(-1);
    expect(resetIdx).toBeGreaterThan(-1);

    // Flag reset must come after compute
    expect(resetIdx).toBeGreaterThan(computeIdx);
  });
});

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, relativePath), "utf8");
}

describe("ArmyManager moving-bounds refresh", () => {
  it("update calls refreshMovingArmyBoundsIfNeeded after batched visible-army updates", () => {
    const source = readSource("./army-manager.ts");

    const methodStart = source.indexOf("update(deltaTime: number, animationContext?: AnimationVisibilityContext)");
    expect(methodStart).toBeGreaterThan(-1);

    const methodBody = source.slice(methodStart, methodStart + 1200);
    const batchedUpdatePos = methodBody.indexOf("this.updateVisibleArmiesBatched()");
    const refreshPos = methodBody.indexOf("this.refreshMovingArmyBoundsIfNeeded()");

    expect(batchedUpdatePos).toBeGreaterThan(-1);
    expect(refreshPos).toBeGreaterThan(-1);
    expect(batchedUpdatePos).toBeLessThan(refreshPos);
  });

  it("refreshMovingArmyBoundsIfNeeded recomputes army and indicator bounds", () => {
    const source = readSource("./army-manager.ts");

    const methodStart = source.indexOf("private refreshMovingArmyBoundsIfNeeded()");
    expect(methodStart).toBeGreaterThan(-1);

    const methodBody = source.slice(methodStart, methodStart + 800);
    expect(methodBody).toContain("this.armyModel.requestBoundsUpdate()");
    expect(methodBody).toContain("this.armyModel.applyPendingBounds()");
    expect(methodBody).toContain("this.playerIndicatorManager.computeBoundingSphere()");
  });
});

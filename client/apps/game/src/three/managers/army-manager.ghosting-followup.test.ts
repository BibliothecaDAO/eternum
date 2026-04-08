import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, relativePath), "utf8");
}

describe("army ghosting follow-up wiring", () => {
  it("hideArmyVisual hides auxiliary visuals in addition to the body slot", () => {
    const src = readSource("army-manager.ts");

    const methodStart = src.indexOf("public hideArmyVisual");
    expect(methodStart).toBeGreaterThan(-1);

    const methodBody = src.slice(methodStart, methodStart + 700);
    expect(methodBody).toContain("this.hideSuppressedArmyAuxiliaryVisuals(entityId)");
  });

  it("updateVisibleArmiesBatched skips suppressed armies before per-frame visual updates", () => {
    const src = readSource("army-manager.ts");

    const methodStart = src.indexOf("private updateVisibleArmiesBatched()");
    expect(methodStart).toBeGreaterThan(-1);

    const methodBody = src.slice(methodStart, methodStart + 1800);
    const loopPos = methodBody.indexOf("const army = this.visibleArmies[i]");
    const suppressedPos = methodBody.indexOf("this.suppressedArmies.has(army.entityId)");
    const pointIconPos = methodBody.indexOf("syncArmyPointIconState(");

    expect(loopPos).toBeGreaterThan(-1);
    expect(suppressedPos).toBeGreaterThan(-1);
    expect(pointIconPos).toBeGreaterThan(-1);
    expect(suppressedPos).toBeGreaterThan(loopPos);
    expect(suppressedPos).toBeLessThan(pointIconPos);
  });

  it("moveArmy attempts immediate render recovery when the army has no visible slot", () => {
    const src = readSource("army-manager.ts");

    const methodStart = src.indexOf("public async moveArmy");
    expect(methodStart).toBeGreaterThan(-1);

    const methodBody = src.slice(methodStart, methodStart + 3200);
    const slotlessBranchPos = methodBody.indexOf("if (matrixIndex === undefined)");
    const renderPos = methodBody.indexOf("await this.renderArmyIntoCurrentChunkIfVisible(entityId)");

    expect(slotlessBranchPos).toBeGreaterThan(-1);
    expect(renderPos).toBeGreaterThan(-1);
    expect(renderPos).toBeGreaterThan(slotlessBranchPos);
  });
});

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, relativePath), "utf8");
}

describe("Stage 5: removal visual hide", () => {
  it("scheduleArmyRemoval calls hideArmyVisual before scheduling timeout", () => {
    const src = readSource("worldmap.tsx");

    // Find the method definition (private scheduleArmyRemoval)
    const methodStart = src.indexOf("private scheduleArmyRemoval(");
    expect(methodStart).toBeGreaterThan(-1);

    const methodBody = src.slice(methodStart, methodStart + 2000);

    const metaSetPos = methodBody.indexOf("pendingArmyRemovalMeta.set(");
    const hideVisualPos = methodBody.indexOf("hideArmyVisual(");
    const schedulePos = methodBody.indexOf("const schedule =");

    expect(metaSetPos).toBeGreaterThan(-1);
    expect(hideVisualPos).toBeGreaterThan(-1);
    expect(schedulePos).toBeGreaterThan(-1);

    // hideArmyVisual must appear after pendingArmyRemovalMeta.set and before const schedule
    expect(hideVisualPos).toBeGreaterThan(metaSetPos);
    expect(hideVisualPos).toBeLessThan(schedulePos);
  });

  it("hideArmyVisual is a public method on ArmyManager", () => {
    const src = readSource("../managers/army-manager.ts");

    expect(src).toContain("public hideArmyVisual");
  });

  it("hideArmyVisual delegates to armyModel.hideInstanceSlot", () => {
    const src = readSource("../managers/army-manager.ts");

    // Extract the hideArmyVisual method body
    const methodStart = src.indexOf("public hideArmyVisual");
    expect(methodStart).toBeGreaterThan(-1);

    const methodBody = src.slice(methodStart, methodStart + 500);
    expect(methodBody).toContain("this.armyModel.hideInstanceSlot");
  });

  it("hideInstanceSlot does not remove from activeInstances", () => {
    const src = readSource("../managers/army-model.ts");

    const methodStart = src.indexOf("public hideInstanceSlot");
    expect(methodStart).toBeGreaterThan(-1);

    // Find the end of the method - look for the next public/private/protected method or closing brace pattern
    const nextMethodMatch = src.slice(methodStart + 1).search(/\n  (public|private|protected) /);
    const methodEnd = nextMethodMatch > -1 ? methodStart + 1 + nextMethodMatch : methodStart + 800;
    const methodBody = src.slice(methodStart, methodEnd);

    // Must NOT contain activeInstances.delete - slot stays allocated for supersede matching
    expect(methodBody).not.toContain("activeInstances.delete");
  });

  it("hideInstanceSlot zeros instance matrix for owning models", () => {
    const src = readSource("../managers/army-model.ts");

    const methodStart = src.indexOf("public hideInstanceSlot");
    expect(methodStart).toBeGreaterThan(-1);

    const methodBody = src.slice(methodStart, methodStart + 800);

    expect(methodBody).toContain("setMatrixAt");
    expect(methodBody).toContain("zeroInstanceMatrix");
    expect(methodBody).toContain("needsUpdate = true");
  });
});

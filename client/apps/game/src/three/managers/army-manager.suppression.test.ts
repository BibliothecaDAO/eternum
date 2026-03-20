import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, relativePath), "utf8");
}

describe("army suppression gate", () => {
  it("suppressedArmies is declared as a private Set", () => {
    const src = readSource("army-manager.ts");
    expect(src).toContain("private suppressedArmies");
    expect(src).toMatch(/suppressedArmies.*new Set/);
  });

  it("hideArmyVisual adds entityId to suppressedArmies", () => {
    const src = readSource("army-manager.ts");

    const methodStart = src.indexOf("public hideArmyVisual");
    expect(methodStart).toBeGreaterThan(-1);

    const methodBody = src.slice(methodStart, methodStart + 500);
    expect(methodBody).toContain("this.suppressedArmies.add(entityId)");
  });

  it("hideArmyVisual calls cleanupMovementSourceBucket", () => {
    const src = readSource("army-manager.ts");

    const methodStart = src.indexOf("public hideArmyVisual");
    expect(methodStart).toBeGreaterThan(-1);

    const methodBody = src.slice(methodStart, methodStart + 500);
    expect(methodBody).toContain("this.cleanupMovementSourceBucket(entityId)");
  });

  it("getVisibleArmiesForChunk filters out suppressed armies", () => {
    const src = readSource("army-manager.ts");

    const methodStart = src.indexOf("private getVisibleArmiesForChunk(");
    expect(methodStart).toBeGreaterThan(-1);

    const methodBody = src.slice(methodStart, methodStart + 2000);

    const seenCheck = methodBody.indexOf("seenArmyIds.has(id)");
    const suppressedCheck = methodBody.indexOf("this.suppressedArmies.has(id)");
    const pushCall = methodBody.indexOf("visibleArmies.push(army)");

    expect(seenCheck).toBeGreaterThan(-1);
    expect(suppressedCheck).toBeGreaterThan(-1);
    expect(pushCall).toBeGreaterThan(-1);

    // suppressed check must appear after seenArmyIds check and before push
    expect(suppressedCheck).toBeGreaterThan(seenCheck);
    expect(suppressedCheck).toBeLessThan(pushCall);
  });

  it("renderArmyIntoCurrentChunkIfVisible checks suppressedArmies", () => {
    const src = readSource("army-manager.ts");

    const methodStart = src.indexOf("private async renderArmyIntoCurrentChunkIfVisible(");
    expect(methodStart).toBeGreaterThan(-1);

    const methodBody = src.slice(methodStart, methodStart + 500);
    expect(methodBody).toContain("this.suppressedArmies.has(entityId)");
  });

  it("drainDeferredArmyQueue skips suppressed armies", () => {
    const src = readSource("army-manager.ts");

    const methodStart = src.indexOf("private drainDeferredArmyQueue(");
    expect(methodStart).toBeGreaterThan(-1);

    const methodBody = src.slice(methodStart, methodStart + 500);
    expect(methodBody).toContain("this.suppressedArmies.has(entityId)");
  });

  it("removeArmy deletes from suppressedArmies", () => {
    const src = readSource("army-manager.ts");

    const methodStart = src.indexOf("public removeArmy(");
    expect(methodStart).toBeGreaterThan(-1);

    const methodBody = src.slice(methodStart, methodStart + 500);
    expect(methodBody).toContain("this.suppressedArmies.delete(entityId)");
  });

  it("unsuppressArmy method exists and deletes from suppressedArmies", () => {
    const src = readSource("army-manager.ts");

    const methodStart = src.indexOf("public unsuppressArmy");
    expect(methodStart).toBeGreaterThan(-1);

    const methodBody = src.slice(methodStart, methodStart + 200);
    expect(methodBody).toContain("this.suppressedArmies.delete(entityId)");
  });

  it("destroy clears suppressedArmies", () => {
    const src = readSource("army-manager.ts");

    const methodStart = src.indexOf("public destroy()");
    expect(methodStart).toBeGreaterThan(-1);

    const methodBody = src.slice(methodStart, methodStart + 2000);
    expect(methodBody).toContain("this.suppressedArmies.clear()");
  });
});
